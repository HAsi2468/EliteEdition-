# Enterprise Zero-Downtime CI/CD Pipeline Guide

This documentation provides an end-to-end reference for the automated Continuous Integration (CI) and Continuous Deployment (CD) pipeline powering the **Elite Edition Enterprise ERP** system.

---

## 1. Pipeline Architecture Overview

```mermaid
flowchart TD
    subgraph Developer Workflow
        A[Git Commit & Push] --> B[Pull Request to develop / main]
    end

    subgraph CI Pipeline (.github/workflows/ci.yml)
        B --> C[Job 1: Lint & Security Audit]
        C --> D[Job 2: Backend Unit & Integration Tests]
        C --> E[Job 3: Frontend Build & Vitest Verification]
    end

    subgraph CD Pipeline (.github/workflows/cd.yml)
        D & E -->|All Checks Pass & Merged to main| F[Pre-Deployment Gate]
        F --> G[SSH Connect to AWS EC2 Mumbai]
        G --> H[Record PREV_COMMIT for Rollback Guard]
        H --> I[Git Reset & Clean npm ci]
        I --> J[PM2 Graceful Cluster Reload: ecosystem.config.cjs]
        J --> K[Nginx Proxy Reload]
        K --> L{Smoke Test: /api/health}
        L -->|HTTP 200 OK| M[Broadcast Version Update via PM2 IPC]
        L -->|Failure| N[🚨 Automatic Rollback to PREV_COMMIT]
        N --> O[PM2 Emergency Reload & Alert On-Call]
    end
```

---

## 2. Required GitHub Secrets Configuration

To enable automated zero-downtime deployment, navigate to your repository on GitHub:  
**Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ **New repository secret**.

| Secret Name | Example Value | Description |
| :--- | :--- | :--- |
| `SERVER_HOST` | `3.7.174.180` | Public IP address or direct hostname of the AWS EC2 instance. |
| `SERVER_USER` | `ubuntu` | Non-root Linux deployment user with PM2 and sudo access. |
| `SERVER_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | Private SSH key (ED25519 or RSA PEM) authorized to access EC2. |
| `SERVER_SSH_PORT` | `22` | SSH port (leave `22` or configure non-standard port). |
| `MONGO_URI` | `mongodb+srv://...` | Production MongoDB Atlas connection URI. |
| `JWT_SECRET` | `4f8a9b2c...` | 32+ character secret string used for signing API tokens. |

> [!IMPORTANT]
> Never commit private keys, `.env` files, or database credentials to version control. All production environment values must reside exclusively in GitHub Secrets and the server's secured `/home/ubuntu/.env` file.

---

## 3. Server SSH Keypair Setup

Run the following commands on your local machine or server to generate and authorize a dedicated deployment key:

### A. Generate a Dedicated ED25519 Deployment Key
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy-bot" -f ~/.ssh/elite_deploy_key
```

### B. Install Public Key on the Target AWS EC2 Server
```bash
# Append public key to the ubuntu user's authorized_keys
cat ~/.ssh/elite_deploy_key.pub | ssh -i ~/.ssh/elite-key-mumbai.pem ubuntu@3.7.174.180 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# Enforce strict Linux file permissions on EC2
ssh -i ~/.ssh/elite-key-mumbai.pem ubuntu@3.7.174.180 "chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

### C. Copy Private Key to GitHub Secrets
Copy the entire contents of `~/.ssh/elite_deploy_key` (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`) into the GitHub Secret named **`SERVER_SSH_KEY`**.

---

## 4. PM2 Cluster & Zero-Downtime Mechanics

The application utilizes [`ecosystem.config.cjs`](file:///Users/harshitsidapara/Node%20projects/Elite_Edition/EliteEditionMongo/ecosystem.config.cjs) configured with PM2 Cluster Mode:

1. **Sequential Worker Reloading (`pm2 reload`)**:
   Instead of stopping the entire server (`pm2 restart`), PM2 reloads Worker 0, waits for it to finish initialization and begin listening (`wait_ready: true`), and only then reloads Worker 1. Live requests and active WebSockets continue serving uninterrupted.
2. **Memory Leak Safeguard (`max_memory_restart: '500M'`)**:
   If Node.js memory approaches 500 MB due to heavy Sharp image transforms or large PDF generation, PM2 automatically recycles that specific worker safely in the background.
3. **Exponential Backoff (`exp_backoff_restart_delay: 200`)**:
   Prevents CPU-pegging loops in case of unexpected unhandled boot crashes.

---

## 5. Production Nginx Server Block Configuration

On the EC2 server (`/etc/nginx/sites-available/eliteedition`), ensure the following reverse-proxy blocks are present:

```nginx
# Upstream PM2 Node Cluster
upstream elite_backend {
    server 127.0.0.1:3001 max_fails=3 fail_timeout=10s;
    keepalive 64;
}

server {
    listen 80;
    server_name erp.eliteedition.in 3.7.174.180;
    return 301 https://erp.eliteedition.in$request_uri;
}

server {
    listen 443 ssl http2;
    server_name erp.eliteedition.in;

    ssl_certificate /etc/letsencrypt/live/erp.eliteedition.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.eliteedition.in/privkey.pem;

    root /home/ubuntu/elite_edition_website_dist;
    index index.html;

    # Frontend Static Assets: Cache hashed chunks for 1 year
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # PWA Entry: Never cache index.html to guarantee instantaneous updates
    location / {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location ~ ^/(v1|api|verify)/ {
        proxy_pass http://elite_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # Real-Time WebSocket / Socket.io Proxy
    location /socket.io/ {
        proxy_pass http://elite_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Test and apply the Nginx configuration:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Post-Deployment Smoke Test & Automated Rollback

The CD pipeline executes an automated verification check against `/api/health`:

```bash
curl -s -f http://127.0.0.1:3001/api/health
```

### Automated Rollback Algorithm
If the health check returns non-200 or times out after 25 attempts:
1. Git resets the working directory back to `HEAD@{1}` (`PREV_COMMIT`).
2. The previous frontend bundle is restored from the local snapshot archive.
3. PM2 reloads the stable codebase gracefully (`pm2 reload ecosystem.config.cjs`).
4. Nginx is reloaded to point to the restored files.
5. Recent error logs (`pm2 logs elite-backend --lines 25`) are captured and dumped into the GitHub Action run log.
6. The GitHub Actions job exits with code `1`, alerting engineering immediately.

---

## 7. Testing the Pipeline End-to-End

### Step 1: Test CI on a Feature Branch
```bash
git checkout -b feature/test-ci-pipeline
echo "// CI validation check" >> EliteEditionMongo/src/utils/skuHelper.js
git add -A && git commit -m "test: verify CI workflow triggers"
git push origin feature/test-ci-pipeline
```
Open a Pull Request on GitHub targeting `main`. Verify that the **Code Quality & Security Audit**, **Backend Test Suite**, and **Frontend Build** checks execute and turn green.

### Step 2: Test Zero-Downtime CD Deployment
Merge the PR into `main`. Navigate to the **Actions** tab on GitHub:
1. Observe the **Pre-Deployment Build & Test Gate** running.
2. Watch the **Zero-Downtime Deployment to EC2** execute.
3. Observe the post-deployment smoke test confirming `HTTP 200 OK`.
4. Check the live server:
```bash
ssh -i ~/.ssh/elite-key-mumbai.pem ubuntu@3.7.174.180 "pm2 status"
```
Both workers (`elite-backend` IDs 30 and 31) will reflect `online` status with zero uptime drop or dropped connections.
