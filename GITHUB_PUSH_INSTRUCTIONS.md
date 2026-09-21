# 🚀 Guide: Connecting & Pushing your LMS Project to GitHub

This guide provides the exact steps to connect your local **LMS System** repository to your new GitHub repository (`https://github.com/ARVR-dlm/LMS-System.git`) and push all project code.

---

## 🛠️ Step-by-Step Commands

### Step 1: Open Terminal at Project Root
Navigate to the root directory of your project:
```bash
cd /Users/mageshk/LMS_System
```

### Step 2: Stage and Commit All Project Files
Stage all untracked/modified files (including `README.md` and the `ARVR` project):
```bash
git add .
git commit -m "feat: initial commit for LMS System"
```

### Step 3: Set Remote URL to your GitHub Repo
Update the existing remote `origin` to point to your new empty repository:
```bash
git remote set-url origin https://github.com/ARVR-dlm/LMS-System.git
```
> *(If `git remote` was not set before, use: `git remote add origin https://github.com/ARVR-dlm/LMS-System.git`)*

### Step 4: Set Branch Name to `main`
Ensure your local branch is named `main`:
```bash
git branch -M main
```

### Step 5: Push Code to GitHub
Push all your local commits and set `origin/main` as the default upstream branch:
```bash
git push -u origin main
```

---

## 💡 Troubleshooting & Notes

- **If your GitHub repo was initialized with a `.gitignore` or `README` on GitHub.com**, standard `git push` might be rejected due to non-matching histories. You can force push to overwrite the empty GitHub repo:
  ```bash
  git push -u origin main --force
  ```
- **To verify remote configuration at any time:**
  ```bash
  git remote -v
  ```
