# 🚀 Complete Deployment Guide: Render (Backend / Database) & Vercel (Frontend)

This guide walks you through pushing your project to GitHub, creating your PostgreSQL database on **Render**, and deploying your Next.js application on **Vercel**.

---

## 📌 Prerequisites Checklist
- [x] GitHub repository connected: `https://github.com/Magesh-03-K/LMS-System.git`
- [ ] [Render.com Account](https://render.com) (for PostgreSQL Database)
- [ ] [Vercel.com Account](https://vercel.com) (for Next.js App & API routes)

---

## 1️⃣ Step 1: Commit and Push Code to GitHub

First, stage all updated files (including updated `.gitignore`) and push to GitHub:

```bash
# Navigate to the workspace root
cd /Users/mageshk/LMS_System

# Stage all files
git add .

# Commit changes
git commit -m "chore: prepare repository for Render and Vercel deployment"

# Ensure main branch
git branch -M main

# Push to GitHub
git push -u origin main
```

*(Note: If push is rejected because your GitHub repo was initialized with files, run `git push -u origin main --force`)*

---

## 2️⃣ Step 2: Create PostgreSQL Database on Render

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → Select **PostgreSQL**.
3. Fill in the details:
   - **Name**: `lms-postgres-db`
   - **Database**: `arvr_academy`
   - **User**: `arvr_user`
   - **Region**: Choose the region closest to you (e.g. Oregon/Frankfurt/Singapore).
   - **Instance Type**: **Free** (or Starter).
4. Click **Create Database**.
5. Once created, copy the **External Database URL** (e.g., `postgresql://arvr_user:password@dpg-xxx.render.com/arvr_academy`).

### 🗄️ Run Database Migrations & Seed Data
From your local terminal, run Prisma migrations and seed the Render database:

```bash
cd /Users/mageshk/LMS_System/ARVR

# Set DATABASE_URL and run migrations on Render PostgreSQL
DATABASE_URL="postgresql://arvr_user:password@dpg-xxx.render.com/arvr_academy?sslmode=require" npx prisma migrate deploy

# Seed demo students, trainers, and initial batches
DATABASE_URL="postgresql://arvr_user:password@dpg-xxx.render.com/arvr_academy?sslmode=require" npx prisma db seed
```

---

## 3️⃣ Step 3: Deploy Frontend & Next.js App on Vercel

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository: `Magesh-03-K/LMS-System`.
4. Configure Project Settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select **`ARVR`**
   - **Build Command**: `npx prisma generate && next build`
   - **Output Directory**: `.next`
5. Environment Variables:
   Add the following variables under **Environment Variables**:

   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `DATABASE_URL` | `postgresql://arvr_user:password@dpg-xxx.render.com/arvr_academy?sslmode=require` | Render PostgreSQL Connection String |
   | `SESSION_SECRET` | `a_super_secret_32_character_string_key_1234` | iron-session encryption secret ($\ge 32$ chars) |
   | `NODE_ENV` | `production` | Production mode |
   | `SKIP_MIGRATIONS` | `true` | Skip container auto-migration on Vercel |

   *(Optional: Add AWS S3 variables if using cloud object storage for screenshots)*
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_S3_BUCKET_NAME`

6. Click **Deploy**. Vercel will build and deploy your full-stack application!

---

## 4️⃣ Step 4 (Optional): Hosting Standalone Web Service on Render

If you also wish to host the Next.js app as a full Node.js web service on Render (instead of Vercel):

1. Go to Render Dashboard → **New +** → **Web Service**.
2. Connect your GitHub repository `Magesh-03-K/LMS-System`.
3. Configure settings:
   - **Root Directory**: `ARVR`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
4. Add Environment Variables (`DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`).
5. Click **Create Web Service**.

---

## 🔑 Demo Login Credentials (Post-Deployment)

Once deployed, access your live URL and test with these credentials:

| Role | Username / Email | Password / PIN | Portal |
| :--- | :--- | :--- | :--- |
| **🎓 Student** | `21CS001` | `123456` | Student Portal |
| **👨‍🏫 Trainer** | `trainer@arvr.com` | `trainer123` | Staff / Instructor Portal |
| **🛡️ Admin** | `admin@arvr.com` | `admin123` | Staff / Instructor Portal |

---

## ✅ Summary of Next Steps
1. Run `git add . && git commit -m "deploy setup" && git push -u origin main`
2. Create PostgreSQL database on Render.
3. Run `npx prisma migrate deploy` with Render `DATABASE_URL`.
4. Import `ARVR` root directory on Vercel, set environment variables, and click Deploy!
