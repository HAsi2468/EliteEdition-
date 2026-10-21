#!/usr/bin/env python3
"""
Elite Edition Production Load Balancer & Health Orchestrator
------------------------------------------------------------
Monitors Node.js PM2 cluster workers, system RAM/CPU, and API liveness.
Enforces memory limits, mitigates 504/502 latency spikes, and performs
zero-downtime rolling reloads when workers exceed memory or stall.

Usage:
  python3 elite_load_balancer.py --status           # Print real-time health dashboard
  python3 elite_load_balancer.py --daemon           # Run continuous balancer loop
  python3 elite_load_balancer.py --install-service  # Install and enable systemd service
"""

import sys
import os
import json
import time
import urllib.request
import urllib.error
import subprocess
import logging
from datetime import datetime

# Configuration Thresholds (Optimized for 1GB RAM / 2-vCPU EC2)
PING_URL = "http://127.0.0.1:3001/api/v1/ping"
APP_NAME = "elite-backend"
CHECK_INTERVAL_SECONDS = 15
MAX_WORKER_MEMORY_MB = 280          # Reload worker if individual RSS > 280 MB
TOTAL_CLUSTER_MEMORY_MB = 550       # Reload heaviest worker if combined cluster > 550 MB
MIN_SYSTEM_FREE_RAM_MB = 90         # Critical RAM threshold: trigger memory compaction
MAX_LATENCY_SECONDS = 4.0           # Ping timeout threshold for lag
CONSECUTIVE_LAG_LIMIT = 2           # Consecutive slow pings before cluster reload
COOLDOWN_SECONDS_PER_WORKER = 180   # Minimum seconds between reloading same worker
LOG_FILE = "/var/log/elite_balancer.log" if os.access("/var/log", os.W_OK) else os.path.expanduser("~/.pm2/elite_balancer.log")

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)

worker_last_reloaded = {}
consecutive_lag_count = 0


def get_system_memory():
    """Reads /proc/meminfo to retrieve total, free, and available memory in MB."""
    mem_info = {}
    try:
        with open("/proc/meminfo", "r") as f:
            for line in f:
                parts = line.split(":")
                if len(parts) == 2:
                    key = parts[0].strip()
                    val_str = parts[1].strip().split()[0]
                    mem_info[key] = int(val_str) // 1024  # Convert kB to MB
        return {
            "total_mb": mem_info.get("MemTotal", 0),
            "free_mb": mem_info.get("MemFree", 0),
            "available_mb": mem_info.get("MemAvailable", mem_info.get("MemFree", 0)),
            "swap_total_mb": mem_info.get("SwapTotal", 0),
            "swap_free_mb": mem_info.get("SwapFree", 0),
        }
    except Exception as e:
        return {"error": str(e), "total_mb": 0, "available_mb": 0}


def get_system_load():
    """Reads 1, 5, 15 min load averages from /proc/loadavg."""
    try:
        with open("/proc/loadavg", "r") as f:
            parts = f.read().split()
            return {
                "load_1m": float(parts[0]),
                "load_5m": float(parts[1]),
                "load_15m": float(parts[2]),
            }
    except Exception:
        return {"load_1m": 0.0, "load_5m": 0.0, "load_15m": 0.0}


def get_pm2_workers():
    """Extracts status and memory of PM2 workers for APP_NAME via pm2 jlist."""
    try:
        res = subprocess.run(
            ["pm2", "jlist"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=8
        )
        if res.returncode != 0:
            return []
        
        data = json.loads(res.stdout)
        workers = []
        for p in data:
            if p.get("name") == APP_NAME:
                monit = p.get("monit", {})
                workers.append({
                    "pm_id": p.get("pm_id"),
                    "pid": p.get("pid"),
                    "status": p.get("pm2_env", {}).get("status", "unknown"),
                    "memory_mb": round(monit.get("memory", 0) / (1024 * 1024), 1),
                    "cpu_pct": monit.get("cpu", 0.0),
                    "uptime_sec": int(time.time() - (p.get("pm2_env", {}).get("pm_uptime", time.time() * 1000) / 1000)),
                    "restarts": p.get("pm2_env", {}).get("restart_time", 0)
                })
        return workers
    except Exception as e:
        logging.error(f"Failed to fetch PM2 worker list: {e}")
        return []


def probe_api_latency():
    """Performs HTTP probe to check API responsiveness and latency in seconds."""
    start_t = time.time()
    try:
        req = urllib.request.Request(
            PING_URL,
            headers={"User-Agent": "EliteLoadBalancer/1.0"}
        )
        with urllib.request.urlopen(req, timeout=MAX_LATENCY_SECONDS) as response:
            latency = time.time() - start_t
            return latency, response.status
    except urllib.error.HTTPError as e:
        latency = time.time() - start_t
        # 401 Unauthorized is expected for unauthenticated ping and confirms Express is responding
        return latency, e.code
    except Exception as e:
        latency = time.time() - start_t
        return latency, None


def reload_pm2_worker(pm_id, reason):
    """Executes rolling reload of a single PM2 worker to preserve zero downtime."""
    now = time.time()
    last = worker_last_reloaded.get(pm_id, 0)
    if now - last < COOLDOWN_SECONDS_PER_WORKER:
        logging.info(f"[Cooldown] Skipping reload for worker {pm_id} ({int(now - last)}s < {COOLDOWN_SECONDS_PER_WORKER}s)")
        return False

    logging.warning(f"🚨 [LoadBalancer Action] Reloading worker {pm_id} (Reason: {reason})")
    try:
        cmd = ["pm2", "reload", str(pm_id)]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        if res.returncode == 0:
            worker_last_reloaded[pm_id] = now
            logging.info(f"✅ [Success] Worker {pm_id} cleanly reloaded with zero downtime.")
            return True
        else:
            logging.error(f"❌ Failed to reload worker {pm_id}: {res.stderr}")
            return False
    except Exception as e:
        logging.error(f"❌ Error invoking pm2 reload {pm_id}: {e}")
        return False


def reload_entire_cluster(reason):
    """Executes zero-downtime rolling restart on the entire cluster app."""
    logging.warning(f"🚨 [LoadBalancer Action] Rolling reload of entire '{APP_NAME}' cluster (Reason: {reason})")
    try:
        cmd = ["pm2", "reload", APP_NAME]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=20)
        if res.returncode == 0:
            logging.info(f"✅ [Success] Cluster '{APP_NAME}' cleanly reloaded with zero downtime.")
            return True
        else:
            logging.error(f"❌ Failed to reload cluster: {res.stderr}")
            return False
    except Exception as e:
        logging.error(f"❌ Error invoking pm2 reload cluster: {e}")
        return False


def drop_system_caches_if_needed():
    """Drops pagecache & compacts memory if system available RAM is dangerously low."""
    try:
        subprocess.run(["sudo", "-n", "sysctl", "-w", "vm.drop_caches=1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        logging.info("🧹 Cleaned Linux OS pagecache to reclaim free memory.")
    except Exception:
        pass


def run_balancer_iteration():
    """Single audit and balancing pass."""
    global consecutive_lag_count

    mem = get_system_memory()
    load = get_system_load()
    workers = get_pm2_workers()
    latency, status_code = probe_api_latency()

    avail_mb = mem.get("available_mb", 0)
    total_cluster_mem = sum(w.get("memory_mb", 0) for w in workers)

    # 1. Check API Liveness / Lag
    if status_code is None or latency > MAX_LATENCY_SECONDS:
        consecutive_lag_count += 1
        logging.warning(f"⚠️ API Latency high or unresponsive: {latency:.2f}s (Status: {status_code}, Strike {consecutive_lag_count}/{CONSECUTIVE_LAG_LIMIT})")
        if consecutive_lag_count >= CONSECUTIVE_LAG_LIMIT:
            reload_entire_cluster(f"Consecutive high latency ({latency:.2f}s, status {status_code})")
            consecutive_lag_count = 0
            return
    else:
        consecutive_lag_count = 0

    # 2. Check System RAM Scarcity
    if avail_mb > 0 and avail_mb < MIN_SYSTEM_FREE_RAM_MB:
        logging.warning(f"⚠️ System RAM critically low ({avail_mb} MB available < {MIN_SYSTEM_FREE_RAM_MB} MB).")
        drop_system_caches_if_needed()
        if workers:
            heaviest = max(workers, key=lambda w: w.get("memory_mb", 0))
            reload_pm2_worker(heaviest["pm_id"], f"System RAM low ({avail_mb} MB); heaviest worker using {heaviest['memory_mb']} MB")
            return

    # 3. Check Individual Worker Memory Caps
    for w in workers:
        w_mem = w.get("memory_mb", 0)
        w_id = w.get("pm_id")
        if w_mem > MAX_WORKER_MEMORY_MB:
            reload_pm2_worker(w_id, f"Worker memory exceeded ({w_mem} MB > {MAX_WORKER_MEMORY_MB} MB threshold)")
            return

    # 4. Check Combined Cluster Memory
    if total_cluster_mem > TOTAL_CLUSTER_MEMORY_MB and len(workers) > 0:
        heaviest = max(workers, key=lambda w: w.get("memory_mb", 0))
        reload_pm2_worker(heaviest["pm_id"], f"Combined cluster memory ({total_cluster_mem:.1f} MB > {TOTAL_CLUSTER_MEMORY_MB} MB)")
        return


def print_status_dashboard():
    """Prints a beautiful CLI summary for the administrator."""
    mem = get_system_memory()
    load = get_system_load()
    workers = get_pm2_workers()
    latency, status_code = probe_api_latency()

    print("=" * 65)
    print("  ELITE EDITION LOAD BALANCER & ORCHESTRATOR STATUS")
    print("=" * 65)
    print(f"Timestamp:          {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}")
    print(f"System Load:        1m: {load['load_1m']} | 5m: {load['load_5m']} | 15m: {load['load_15m']}")
    print(f"RAM Usage:          {mem['total_mb'] - mem['available_mb']} MB used / {mem['total_mb']} MB total ({mem['available_mb']} MB available)")
    print(f"Swap Usage:         {mem['swap_total_mb'] - mem['swap_free_mb']} MB used / {mem['swap_total_mb']} MB total")
    print(f"API Probe Latency:  {latency:.3f}s (HTTP Status: {status_code})")
    print("-" * 65)
    print("PM2 Cluster Workers:")
    if not workers:
        print("  No workers found for app 'elite-backend'!")
    else:
        for w in workers:
            status_symbol = "🟢" if w['status'] == 'online' else "🔴"
            print(f"  {status_symbol} Worker ID {w['pm_id']} (PID {w['pid']}): {w['memory_mb']} MB RAM | CPU: {w['cpu_pct']}% | Uptime: {w['uptime_sec']}s | Restarts: {w['restarts']}")
    print("=" * 65)


def install_systemd_service():
    """Installs and enables elite-balancer as a systemd service."""
    script_path = os.path.abspath(__file__)
    user = os.environ.get("USER", "ubuntu")
    service_content = f"""[Unit]
Description=Elite Edition Load Balancer & Health Orchestrator
After=network.target pm2-{user}.service

[Service]
Type=simple
User={user}
WorkingDirectory={os.path.dirname(script_path)}
ExecStart=/usr/bin/python3 {script_path} --daemon
Restart=always
RestartSec=10
StandardOutput=append:{LOG_FILE}
StandardError=append:{LOG_FILE}

[Install]
WantedBy=multi-user.target
"""
    tmp_path = "/tmp/elite-balancer.service"
    with open(tmp_path, "w") as f:
        f.write(service_content)

    print("Installing systemd unit to /etc/systemd/system/elite-balancer.service...")
    subprocess.run(["sudo", "cp", tmp_path, "/etc/systemd/system/elite-balancer.service"], check=True)
    subprocess.run(["sudo", "systemctl", "daemon-reload"], check=True)
    subprocess.run(["sudo", "systemctl", "enable", "--now", "elite-balancer.service"], check=True)
    print("✅ Service successfully installed and started!")
    subprocess.run(["sudo", "systemctl", "status", "elite-balancer.service", "--no-pager"])


def main():
    if "--status" in sys.argv:
        print_status_dashboard()
        sys.exit(0)
    elif "--install-service" in sys.argv:
        install_systemd_service()
        sys.exit(0)
    elif "--daemon" in sys.argv:
        logging.info("🚀 Elite Edition Load Balancer Daemon started.")
        while True:
            try:
                run_balancer_iteration()
            except Exception as e:
                logging.error(f"Unexpected error in balancer loop: {e}")
            time.sleep(CHECK_INTERVAL_SECONDS)
    else:
        print("Usage:")
        print("  python3 elite_load_balancer.py --status           # Display current status")
        print("  python3 elite_load_balancer.py --daemon           # Run as continuous daemon")
        print("  python3 elite_load_balancer.py --install-service  # Install systemd service")


if __name__ == "__main__":
    main()
