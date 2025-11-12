# ✅ CI/CD Setup Checklist

Quick guide to get your CI/CD pipeline operational.

---

## 📋 Pre-Deployment Checklist

### 1️⃣ Repository Setup

- [ ] Push workflow files to `.github/workflows/` directory
- [ ] Verify workflows appear in **Actions** tab
- [ ] Enable Actions if disabled (Settings > Actions > Allow all actions)

### 2️⃣ GitHub Secrets Configuration

Navigate to: **Settings > Secrets and variables > Actions > New repository secret**

**Required:**
- [ ] `GOOGLE_API_KEY` - Your Gemini API key
  ```
  Value: AIzaSy... (your actual API key)
  ```

**Optional (for Codecov):**
- [ ] `CODECOV_TOKEN` - Coverage upload token
  - Sign up at https://codecov.io
  - Connect repository
  - Copy token from Settings

**Optional (for Docker Hub):**
- [ ] `DOCKER_HUB_USERNAME`
- [ ] `DOCKER_HUB_TOKEN`

**Optional (for Deployment):**
Choose your platform and add corresponding secrets:

- [ ] **AWS**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- [ ] **Azure**: `AZURE_CREDENTIALS`
- [ ] **GCP**: `GCP_SA_KEY`
- [ ] **DigitalOcean**: `DIGITALOCEAN_TOKEN`
- [ ] **Heroku**: `HEROKU_API_KEY`

### 3️⃣ Branch Protection

Navigate to: **Settings > Branches > Add branch protection rule**

**For `main` branch:**
- [ ] Branch name pattern: `main`
- [ ] Require pull request reviews: **1 approval**
- [ ] Require status checks to pass before merging
  - [ ] `backend-tests`
  - [ ] `frontend-tests`
  - [ ] `build-docker`
- [ ] Require branches to be up to date before merging
- [ ] Require conversation resolution before merging

### 4️⃣ Test the Pipeline

- [ ] Create a test branch
  ```powershell
  git checkout -b test/ci-pipeline
  ```

- [ ] Make a small change (e.g., update README)
  ```powershell
  echo "Testing CI/CD" >> README.md
  git add README.md
  git commit -m "test: Trigger CI/CD pipeline"
  git push origin test/ci-pipeline
  ```

- [ ] Create a Pull Request
- [ ] Verify PR checks run automatically
- [ ] Check **Actions** tab for workflow progress
- [ ] Ensure all checks pass ✅

### 5️⃣ Configure Deployment (Optional)

**Choose ONE platform:**

#### Option A: AWS ECS
- [ ] Create ECS cluster
- [ ] Create task definition
- [ ] Update `ci-cd.yml` with deployment step
- [ ] Add AWS credentials to secrets

#### Option B: Google Cloud Run
- [ ] Enable Cloud Run API
- [ ] Create service account with Cloud Run Admin role
- [ ] Update `ci-cd.yml` with deployment step
- [ ] Add service account key to secrets

#### Option C: Azure App Service
- [ ] Create App Service
- [ ] Create Container Registry
- [ ] Update `ci-cd.yml` with deployment step
- [ ] Add Azure credentials to secrets

#### Option D: DigitalOcean App Platform
- [ ] Create App in App Platform
- [ ] Connect to GitHub repository
- [ ] Update `ci-cd.yml` with deployment step
- [ ] Add DigitalOcean token to secrets

#### Option E: Heroku
- [ ] Create Heroku app
- [ ] Enable container registry
- [ ] Update `ci-cd.yml` with deployment step
- [ ] Add Heroku API key to secrets

### 6️⃣ Monitoring Setup

- [ ] Set up Codecov dashboard (if using)
- [ ] Enable GitHub Security alerts
  - Navigate to: **Settings > Security & analysis**
  - Enable: Dependabot alerts, Dependabot security updates, Code scanning
- [ ] Add status badges to README.md

### 7️⃣ Local Testing Verification

Before relying on CI/CD, ensure tests pass locally:

**Backend:**
```powershell
cd backend
pytest -v --cov=. --cov-report=html
```

**Frontend:**
```powershell
cd frontend
npm test
```

**Docker:**
```powershell
docker-compose up --build
```

---

## 🚀 Quick Start Commands

### Initial Push
```powershell
# Commit workflow files
git add .github/workflows/
git commit -m "ci: Add CI/CD pipeline"
git push origin main
```

### Create Test PR
```powershell
git checkout -b test/pipeline
echo "Test" >> README.md
git add README.md
git commit -m "test: Verify pipeline"
git push origin test/pipeline
# Create PR in GitHub UI
```

### View Pipeline Status
```powershell
# Open GitHub Actions in browser
start https://github.com/abanoubmedhat/feedback_analyzer/actions
```

---

## 🎯 Success Criteria

### ✅ Pipeline is Ready When:

1. [ ] Workflows visible in Actions tab
2. [ ] PR checks run automatically
3. [ ] Backend tests pass (38/38 ✅)
4. [ ] Frontend tests pass (≥20/35 ✅)
5. [ ] Docker images build successfully
6. [ ] Security scan completes
7. [ ] No secrets in code (all in GitHub Secrets)

### ✅ Deployment is Ready When:

1. [ ] Staging environment accessible
2. [ ] Database migrations run automatically
3. [ ] Environment variables configured
4. [ ] Health check endpoints respond
5. [ ] Rollback procedure tested

---

## 🐛 Common Issues

### Issue: "Actions not running"
**Solution:** Check if Actions are enabled in Settings > Actions

### Issue: "Secret not found"
**Solution:** Verify secret name matches exactly (case-sensitive)

### Issue: "Tests fail in CI but pass locally"
**Solution:** Check environment variables, Python/Node versions

### Issue: "Docker build fails"
**Solution:** Clear cache, check .dockerignore, verify file paths

---

## 📞 Need Help?

1. ✅ Review [CI_CD_GUIDE.md](./CI_CD_GUIDE.md) for detailed docs
2. ✅ Check Actions tab for error logs
3. ✅ Test locally first: `run_tests.bat`
4. ✅ Verify secrets are configured correctly

---

## 📈 Next Steps After Setup

1. **Monitor First Few Runs**: Watch for any issues
2. **Optimize Pipeline**: Add caching, improve test speed
3. **Set Up Alerts**: Configure notifications for failures
4. **Document Deployment**: Add runbook for team
5. **Plan Production Deployment**: Create production workflow

---

**Estimated Setup Time**: 15-30 minutes
**Difficulty**: ⭐⭐⭐ (Intermediate)
**Status**: Ready to implement
