# AR/VR Academy — Production AWS Deployment Runbook

Comprehensive Step-by-Step Operator Guide & Architectural Specification.

---

## 1. AWS Architecture Overview

The AR/VR Academy production infrastructure follows the **Serverless Container & Managed Services** architecture pattern:

```
                                    INTERNET
                                       │
                                       ▼
                          [Route 53 DNS & ACM SSL]
                                       │
                                       ▼
                        [AWS WAF v2 Web Application Firewall]
                        - AWSManagedRulesCommonRuleSet
                        - AWSManagedRulesKnownBadInputsRuleSet
                        - RateLimit500Per5Min
                                       │
                                       ▼
                   [Public Subnets (AZ-a & AZ-b)]
                   ┌────────────────────────────────────────┐
                   │   Application Load Balancer (ALB)      │
                   │   - HTTPS (Port 443) -> TLS 1.3        │
                   │   - HTTP (Port 80) -> Redirect to 443  │
                   │   - Health Check: GET /api/health      │
                   └───────────────────┬────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        │                                                             │
        ▼                                                             ▼
   [Private Subnet AZ-a]                                         [Private Subnet AZ-b]
   ┌────────────────────────────────────────┐                   ┌────────────────────────────────────────┐
   │  ECS Fargate Task (Replica 1)          │                   │  ECS Fargate Task (Replica 2)          │
   │  - Non-root user (nextjs:1001)         │                   │  - Non-root user (nextjs:1001)         │
   │  - Port 3000 (Internal)                │                   │  - Port 3000 (Internal)                │
   │  - CloudWatch logs: /ecs/arvr-academy  │                   │  - CloudWatch logs: /ecs/arvr-academy  │
   └───────────────────┬────────────────────┘                   └───────────────────┬────────────────────┘
                       │                                                            │
                       ├───────────────────────────────┬────────────────────────────┤
                       │                               │                            │
                       ▼                               ▼                            ▼
        [Private S3 Bucket]              [Amazon RDS PostgreSQL]       [Amazon ElastiCache Redis]
        - Direct Presigned PUT/GET       - Multi-AZ Sync Standby       - Redis 7 In-Memory
        - KMS Encryption                 - Automated Backups (14 days) - Transit & At-Rest Encryption
        - Versioning & CORS              - Storage Auto-Scaling        - Sliding-Window Rate Limit
```

### Justification of Services: Why ECS/Fargate Over EKS or EC2?
- **EKS (Elastic Kubernetes Service)** was evaluated and **rejected**: Managing a Kubernetes cluster introduces substantial operational friction ($73/mo per cluster control plane cost, managing complex Kubernetes API version upgrades, CNI networking, ingress controllers, node group scaling, and etcd backups) without measurable architectural gain for a unified Next.js web application.
- **EC2 (Virtual Machines)** was evaluated and **rejected**: Requires custom golden AMI creation, OS security patching, SSH key rotation, Auto-Scaling Group configuration, and carries significant risk of server drift.
- **ECS with AWS Fargate** was **selected**: Delivers serverless container orchestration with zero virtual machines to manage. Out-of-the-box integration with ALB, AWS Secrets Manager, IAM task roles, CloudWatch Logs, and built-in **Deployment Circuit Breaker with automated rollback**.

---

## 2. Networking Architecture (VPC Design)

- **VPC CIDR**: `10.0.0.0/16` across 2 Availability Zones (`us-east-1a`, `us-east-1b`) ensuring fault tolerance.
- **3-Tier Subnet Segmentation**:
  1. **Tier 1 — Public Subnets** (`10.0.1.0/24`, `10.0.2.0/24`):
     - Hosts the Application Load Balancer and a single managed NAT Gateway.
     - Routed directly to the Internet Gateway (IGW).
  2. **Tier 2 — Private Application Subnets** (`10.0.10.0/24`, `10.0.11.0/24`):
     - Hosts the ECS Fargate application containers.
     - Outbound internet access routes through the NAT Gateway (enables downloading S3 presigned URLs, Google OAuth callbacks, and third-party APIs).
     - No public IPv4 addresses are assigned to containers.
  3. **Tier 3 — Isolated Data Subnets** (`10.0.100.0/24`, `10.0.101.0/24`):
     - Hosts Amazon RDS PostgreSQL and Amazon ElastiCache Redis.
     - **Zero route to the internet or NAT Gateway**. Completely isolated from external ingress/egress.
- **S3 Gateway VPC Endpoint**: Configured on the private application route table to route all S3 traffic over the internal AWS backbone, bypassing NAT Gateway bandwidth data processing charges.

---

## 3. Security Groups (Zero-Trust Network Controls)

| Security Group | Inbound Rules | Outbound Rules | Purpose |
| :--- | :--- | :--- | :--- |
| **`alb-sg`** | `TCP 80` from `0.0.0.0/0`<br>`TCP 443` from `0.0.0.0/0` | `TCP 3000` to `ecs-tasks-sg` | Public HTTPS termination and traffic forwarding |
| **`ecs-tasks-sg`** | `TCP 3000` ONLY from `alb-sg` | `TCP 5432` to `rds-sg`<br>`TCP 6379` to `redis-sg`<br>`TCP 443` to `0.0.0.0/0` (NAT/APIs) | Application container traffic isolation |
| **`rds-sg`** | `TCP 5432` ONLY from `ecs-tasks-sg` | None | Strict database protection |
| **`redis-sg`** | `TCP 6379` ONLY from `ecs-tasks-sg` | None | Strict cache cluster protection |

---

## 4. IAM Roles & Least-Privilege Policies

1. **ECS Task Execution Role (`ecs-execution-role`)**:
   - Used by the AWS ECS container infrastructure agent.
   - Policies attached:
     - `AmazonECSTaskExecutionRolePolicy`: Pulls Docker image layers from private ECR and streams container `stdout`/`stderr` to CloudWatch Logs.
     - Inline policy `secretsmanager:GetSecretValue`: Allows decryption and retrieval of the specific application secret ARN (`arvr-academy/production/app-secrets`).
2. **ECS Task Role (`ecs-task-role`)**:
   - Used by application code running inside the container.
   - Policies attached:
     - Scoped strictly to S3 object actions (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject`) and `s3:ListBucket` on the private submissions bucket (`arvr-academy-submissions-production-*`).
     - **No administrative or broad AWS permissions**.

---

## 5. Environment Variables vs. Secrets Strategy

| Variable Name | Classification | Mechanism | Injected By |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Non-sensitive (`production`) | ECS Task Definition `environment` | ECS Agent |
| `PORT` | Non-sensitive (`3000`) | ECS Task Definition `environment` | ECS Agent |
| `HOSTNAME` | Non-sensitive (`0.0.0.0`) | ECS Task Definition `environment` | ECS Agent |
| `SKIP_MIGRATIONS` | Operational flag (`false`) | ECS Task Definition `environment` | ECS Agent |
| `DATABASE_URL` | **Secret** | AWS Secrets Manager (`DATABASE_URL`) | Injected into container RAM |
| `SESSION_SECRET` | **Secret** | AWS Secrets Manager (`SESSION_SECRET`) | Injected into container RAM |
| `REDIS_URL` | **Secret** | AWS Secrets Manager (`REDIS_URL`) | Injected into container RAM |
| `AWS_S3_BUCKET_NAME` | Config/Secret | AWS Secrets Manager / Task Definition | Injected into container RAM |
| `GOOGLE_CLIENT_SECRET` | **Secret** | AWS Secrets Manager (`GOOGLE_CLIENT_SECRET`) | Injected into container RAM |

> [!IMPORTANT]
> Zero credentials, passwords, or tokens are baked into the Docker image or stored in Git. All secrets are retrieved dynamically by ECS during container initialization.

---

## 6. Database (Amazon RDS PostgreSQL 16)

- **Engine & Version**: PostgreSQL 16.3 on `db.t4g.medium` (ARM64 Graviton processor for superior cost-performance).
- **Multi-AZ**: Enabled. Synchronous physical standby replica provisioned in second Availability Zone with automated failover (typically $< 60$ seconds).
- **Storage**: 50 GB baseline gp3 SSD with auto-scaling enabled up to 200 GB.
- **Encryption**: KMS storage encryption at rest (`aws/rds`) and parameter group enforcing TLS in-transit (`rds.force_ssl = 1`).
- **Backup Strategy**:
  - Automated daily snapshots during low-traffic window (`03:00-04:00 UTC`).
  - 14-day Point-In-Time-Recovery (PITR) retention window enabling restore to any second in the past 14 days.
  - Deletion protection enabled.

---

## 7. Storage (Amazon S3 Private Bucket)

- **Bucket**: `arvr-academy-submissions-production-<random-id>`
- **Security**:
  - `BlockPublicAccess` enabled (all 4 public access block flags set to `true`).
  - Server-Side Encryption with AES-256 enabled by default.
  - Bucket policy strictly denies non-HTTPS requests (`aws:SecureTransport: false`).
  - S3 Versioning enabled to protect against accidental file overwrites or malicious deletions.
- **CORS Configuration**: Configured to allow `PUT`, `GET`, and `HEAD` requests directly from `https://academy.yourdomain.com` for direct browser-to-S3 presigned uploads.
- **Lifecycle Policies**: Files transition to S3 Standard-Infrequent Access after 90 days, and S3 Glacier Flexible Archive after 365 days.

---

## 8. Redis (Amazon ElastiCache for Redis 7)

- **Engine**: Redis 7 on `cache.t4g.small` Multi-AZ with automatic failover.
- **Security**:
  - In-transit encryption (TLS) enabled.
  - At-rest encryption enabled.
  - Redis `AUTH` token enabled.
- **Eviction Policy**: `volatile-lru` (evicts expired keys first when memory pressure occurs).
- **Usage in App**: Backs the distributed sliding-window rate limiter, student PIN account lockout, and instant server-side session revocation on logout.

---

## 9. Step-by-Step Deployment Guide

### Phase 1: Provision Infrastructure with Terraform
```bash
# 1. Navigate to deployment directory
cd deploy/aws

# 2. Initialize Terraform providers (AWS, Random)
terraform init

# 3. Preview planned resources
terraform plan -out=tfplan

# 4. Apply infrastructure (Provisions VPC, RDS, Redis, S3, ALB, ECS)
terraform apply tfplan
```

### Phase 2: Build & Push Docker Image to Amazon ECR
```bash
# 1. Retrieve AWS Account ID and ECR Login credentials
export AWS_REGION="us-east-1"
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_URL="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/arvr-academy"

# 2. Authenticate Docker with ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL

# 3. Build production Docker image locally
docker build -t arvr-academy:latest -f Dockerfile .

# 4. Tag image for ECR
docker tag arvr-academy:latest ${ECR_URL}:latest
docker tag arvr-academy:latest ${ECR_URL}:v1.0.0

# 5. Push image to Amazon ECR
docker push ${ECR_URL}:latest
docker push ${ECR_URL}:v1.0.0
```

### Phase 3: Run One-Off Database Migration Task
To run migrations safely without relying on application container boot, execute a standalone Fargate task:
```bash
aws ecs run-task \
  --cluster arvr-academy-cluster-production \
  --task-definition arvr-academy-production \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<PRIVATE_APP_SUBNET_1>],securityGroups=[<ECS_TASKS_SG>],assignPublicIp=DISABLED}" \
  --overrides '{
    "containerOverrides": [
      {
        "name": "arvr-academy-app",
        "command": ["npx", "prisma", "db", "push", "--skip-generate"]
      }
    ]
  }'
```

### Phase 4: Deploy ECS Service with Rolling Zero-Downtime Update
```bash
# Force a new deployment to pick up the newly pushed image
aws ecs update-service \
  --cluster arvr-academy-cluster-production \
  --service arvr-academy-service-production \
  --force-new-deployment
```

### Phase 5: Automated Verification & Health Check
```bash
# 1. Query the ALB DNS name or custom domain health endpoint
export ALB_DNS=$(aws elbv2 describe-load-balancers --names arvr-academy-alb-production --query "LoadBalancers[0].DNSName" --output text)
curl -i https://${ALB_DNS}/api/health

# Expected HTTP 200 OK Response:
# {
#   "status": "healthy",
#   "timestamp": "2026-09-10T18:30:00.000Z",
#   "uptime": 120,
#   "checks": {
#     "database": { "status": "connected", "latencyMs": 3 },
#     "redis": { "status": "connected", "latencyMs": 1 },
#     "storage": { "provider": "AWS_S3", "configured": true }
#   }
# }
```

---

## 10. Deployment Rollback Strategy

The architecture incorporates **three levels of automated and manual rollback**:

1. **ECS Deployment Circuit Breaker (Automated)**:
   - Configured with `rollback = true`.
   - If a new deployment fails ALB health checks (`GET /api/health`), crashes on startup, or enters a crash loop, the circuit breaker triggers automatically.
   - ECS halts the deployment, stops the unhealthy new tasks, and immediately rolls back to the previous healthy task definition version without operator intervention.
2. **Minimum Healthy Percent (Zero-Downtime Guarantee)**:
   - `minimumHealthyPercent = 100` ensures that at least 2 healthy tasks remain running and serving production traffic at all times while new containers are booting and warming up.
3. **Manual Instant Rollback (CLI)**:
   If an application bug is discovered after deployment has settled:
   ```bash
   # Revert service to previous task definition revision (e.g. revision 4)
   aws ecs update-service \
     --cluster arvr-academy-cluster-production \
     --service arvr-academy-service-production \
     --task-definition arvr-academy-production:<PREVIOUS_REVISION_NUMBER>
   ```

---

## 11. Estimated Operational Complexity & Monthly Costs

### Operational Complexity Rating: **LOW to MODERATE**
- **Zero Host Maintenance**: No EC2 AMIs to patch or upgrade. Fargate abstracts the underlying Linux kernel and OS entirely.
- **Automated Database Maintenance**: Minor version PostgreSQL updates and weekly maintenance windows are applied automatically by RDS.
- **Single Operational Dashboard**: All application logs, metrics (CPU/Memory/Network), and ALB request metrics converge in Amazon CloudWatch.

### Estimated Monthly AWS Cost Breakdown (US East, Production)

| Service | Configuration | Estimated Monthly Cost |
| :--- | :--- | :--- |
| **ECS Fargate** | 2 tasks $\times$ 1 vCPU, 2 GB RAM (24/7) | ~$72.00 |
| **Application Load Balancer** | 1 ALB + LCU processing (~1 GB/hr) | ~$22.00 |
| **Amazon RDS PostgreSQL** | `db.t4g.medium` Multi-AZ, 50 GB gp3 storage | ~$115.00 |
| **Amazon ElastiCache Redis**| `cache.t4g.small` Multi-AZ (2 nodes) | ~$48.00 |
| **Amazon S3** | 100 GB storage + presigned PUT/GET requests | ~$3.50 |
| **AWS Secrets Manager** | 1 secret + API calls | ~$0.50 |
| **Amazon CloudWatch** | 10 GB log ingestion + 30-day retention + metrics | ~$6.50 |
| **NAT Gateway** | 1 NAT Gateway (outbound API traffic) | ~$35.00 |
| **AWS WAF v2** | 1 Web ACL + 3 managed rule sets | ~$12.00 |
| **Total Estimated Cost** | | **~$314.50 / month** |

*(For staging/development environments, costs can be reduced to **~$75/month** by using Single-AZ RDS `db.t4g.micro`, single-node Redis `cache.t4g.micro`, and 1 Fargate task).*
