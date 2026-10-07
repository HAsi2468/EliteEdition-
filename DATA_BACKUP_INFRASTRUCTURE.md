# 🛡️ Data Backup & Infrastructure Architecture Tracker
### Elite Edition Enterprise ERP — Production Infrastructure System

> **System Domain:** `erp.eliteedition.in`  
> **Production EC2 IP:** `3.7.174.180` (AWS Mumbai `ap-south-1`)  
> **AWS Account ID:** `056885488683`  
> **IAM Service User:** `elite-billing-service`  

---

## 📊 11 Infrastructure Components — Live Status Board

| # | Component Name | Category / Tier | Priority | Current Status | Technical Implementation Details |
|---|---|---|:---:|:---:|---|
| **1** | **Cloudflare R2** | Zero-Egress Media Store | P0 | <span style="color:#16a34a; font-weight:800">✅ COMPLETED</span> | S3-compatible API integrated in `r2Storage.js`, chunked multipart uploader, presigned URLs, CSP allowed. |
| **2** | **Amazon S3 (Standard)** | Object Storage | P1 | <span style="color:#d97706; font-weight:800">🔄 READY IN CODE</span> | `@aws-sdk/client-s3` installed & tested. Ready to link AWS S3 bucket for operational document archives. |
| **3** | **MongoDB Atlas (M10)** | Dedicated Managed DB | P1 | <span style="color:#d97706; font-weight:800">🟡 CONNECTED (M0)</span> | Live connected (`eliteedition.qq3aqjz.mongodb.net`). Ready for one-click cluster scale-up to dedicated M10 with continuous backups. |
| **4** | **Amazon Route 53** | DNS, Failover & Health Checks | P1 | <span style="color:#2563eb; font-weight:800">🚀 IN PROGRESS</span> | High-speed DNS routing with automated health checks on `https://erp.eliteedition.in` and failover routing. |
| **5** | **AWS Certificate Manager (ACM)** | Free Auto-Renewing SSL | P1 | <span style="color:#2563eb; font-weight:800">🚀 IN PROGRESS</span> | Request wildcard certificate (`*.eliteedition.in`, `eliteedition.in`) validated via Route 53 DNS. |
| **6** | **Amazon CloudFront** | Global Edge CDN Distribution | P2 | <span style="color:#64748b; font-weight:800">📋 PLANNED</span> | Edge distribution in front of EC2 & S3, terminating HTTPS with ACM SSL certificate. |
| **7** | **AWS WAF** | Web Application Firewall & DDoS | P2 | <span style="color:#d97706; font-weight:800">🟡 PARTIAL (App Level)</span> | App-layer security active (Helmet, Mongo-Sanitize, Rate Limiting, CSRF tokens). AWS WAF attaches to CloudFront. |
| **8** | **AWS Secrets Manager** | Centralized Credential Vault | P2 | <span style="color:#64748b; font-weight:800">📋 PLANNED</span> | Replaces static server `.env` files with dynamic encrypted secret retrieval at app launch. |
| **9** | **AWS KMS** | Hardware Key Encryption | P2 | <span style="color:#64748b; font-weight:800">📋 PLANNED</span> | Customer Master Key (CMK) envelope encryption for database backups, S3 data at rest, and secret keys. |
| **10** | **AWS Backup Service** | Automated Snapshot Vault | P2 | <span style="color:#64748b; font-weight:800">📋 PLANNED</span> | Automated daily scheduled backup plans and retention policies for EC2 EBS volumes and S3 storage. |
| **11** | **Amazon S3 Glacier Flexible Archive** | Deep Cold Storage Archive | P3 | <span style="color:#64748b; font-weight:800">📋 PLANNED</span> | S3 Lifecycle transition rules: auto-moves files >90/180 days to Glacier for ~80% storage cost reduction. |

---

## 🗺️ Step-by-Step Dependency Roadmap

```
Phase 1: DNS & SSL Foundation (CURRENT PHASE)
  ├── 1. Amazon Route 53 Hosted Zone & Health Checks
  └── 2. AWS Certificate Manager (ACM) Wildcard SSL (*.eliteedition.in)

Phase 2: Edge Delivery & Perimeter Protection
  ├── 3. Amazon CloudFront Distribution (Pointing to EC2 & S3)
  └── 4. AWS WAF (Web ACL rules for Rate Limiting, SQLi, XSS, Bot Control)

Phase 3: Storage & Long-Term Archiving
  ├── 5. Amazon S3 Standard Storage (Bucket provisioned in ap-south-1)
  ├── 6. Amazon S3 Glacier Flexible Archive (Lifecycle retention rules)
  └── 7. Cloudflare R2 (Synchronized or parallel zero-egress media serving)

Phase 4: Security Hardening & Automated Protection
  ├── 8. AWS KMS Customer Master Key (CMK)
  ├── 9. AWS Secrets Manager (Automated credential rotation)
  └── 10. AWS Backup Service (Automated daily EBS/S3 snapshots)

Phase 5: High-Performance Database Scaling
  └── 11. MongoDB Atlas M10 Cluster (Dedicated CPU/RAM & Point-in-time recovery)
```

---

## 📌 Current Next Action: Amazon Route 53 & AWS Certificate Manager (ACM)

1. **IAM Permissions Requirement**:
   - The IAM user `elite-billing-service` (`arn:aws:iam::056885488683:user/elite-billing-service`) needs permissions attached:
     - `AmazonRoute53FullAccess`
     - `AWSCertificateManagerFullAccess`
2. **Amazon Route 53 Setup**:
   - Create Public Hosted Zone for `eliteedition.in` in Route 53.
   - Configure Route 53 Health Check monitoring `https://erp.eliteedition.in/` (port 443).
   - Configure A-Record routing to EC2 `3.7.174.180` with health check association.
3. **AWS Certificate Manager (ACM) Setup**:
   - Request Public Certificate for:
     - `*.eliteedition.in`
     - `eliteedition.in`
   - Select **DNS Validation** ➔ Click **Create records in Route 53** (one-click instant validation).
