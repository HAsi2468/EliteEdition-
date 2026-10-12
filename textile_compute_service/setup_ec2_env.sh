#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "🚀 ELITE EDITION EC2 HARDENING & PYTHON COMPUTE SETUP"
echo "=========================================================="

# 1. 4 GiB NVMe Swapfile Setup
echo "=== 1. Checking / Allocating 4 GiB NVMe Swapfile ==="
if [ ! -f /swapfile ]; then
    sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap created successfully."
else
    echo "Swapfile already present."
fi

# Set swappiness to 10
sudo sysctl vm.swappiness=10
sudo sysctl vm.vfs_cache_pressure=50
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf

# 2. System Packages (Python 3.12, libvips, redis)
echo "=== 2. Installing System Packages (Python 3.12, libvips, Redis) ==="
sudo apt-get update
sudo apt-get install -y \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    libvips \
    libvips-dev \
    libvips-tools \
    redis-server \
    pkg-config \
    build-essential

# 3. Create Virtual Environment
echo "=== 3. Creating Virtual Environment ==="
cd ~/EliteEditionMongo/textile_compute_service
if [ ! -d "venv" ]; then
    python3.12 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 4. Install systemd service units
echo "=== 4. Configuring systemd unit files ==="
sudo cp textile-api.service /etc/systemd/system/
sudo cp textile-celery.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable redis-server
sudo systemctl enable textile-api
sudo systemctl enable textile-celery

sudo systemctl restart redis-server
sudo systemctl restart textile-api
sudo systemctl restart textile-celery

echo "=========================================================="
echo "✅ PYTHON TEXTILE COMPUTE ENGINE IS ONLINE & RUNNING!"
echo "=========================================================="
