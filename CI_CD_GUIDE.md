# 🚀 CI/CD Pipeline Documentation

## Overview

This project includes a comprehensive CI/CD pipeline using **GitHub Actions** that automatically tests, builds, and validates code changes.

---

## 📋 Pipeline Components

### 1. Main CI/CD Pipeline (`ci-cd.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch

**Jobs:**

#### 🧪 Backend Tests
- Sets up Python 3.11
- Installs dependencies
- Runs flake8 linting
- Executes pytest with coverage
- Uploads coverage to Codecov

#### 🎨 Frontend Tests
- Sets up Node.js 18
- Installs dependencies
- Runs ESLint
- Executes Vitest tests
- Uploads coverage to Codecov

#### 🐳 Docker Build
- Builds backend and frontend Docker images
- Uses layer caching for faster builds
- Validates Docker configurations

#### 🔒 Security Scanning
- Runs Trivy vulnerability scanner
- Scans for security issues in code and dependencies
- Uploads results to GitHub Security tab

#### 🚀 Deploy to Staging
- Only runs on `main` branch
- Deploys to staging environment
- Requires manual approval

---

## 🔄 Pull Request Checks (`pr-checks.yml`)

**Purpose:** Fast feedback on PRs before full CI/CD runs

**Checks:**
- ✅ Merge conflict detection
- ✅ Docker Compose validation
- ✅ Required files present
- ✅ Quick smoke tests
- ✅ PR size warnings

---

## 🔐 Dependency Checks (`dependency-check.yml`)

**Schedule:** Weekly on Mondays at 9 AM UTC

**Actions:**
- Checks for outdated Python packages
- Checks for outdated Node packages
- Scans for security vulnerabilities
- Creates GitHub issue if problems found

---

## 🛠️ Setup Instructions

### 1. Enable GitHub Actions

Actions are enabled by default when you push the workflow files to `.github/workflows/`

### 2. Configure Secrets

Add these secrets in **Settings > Secrets and variables > Actions**:

Required:
- `GOOGLE_API_KEY` - Your Gemini API key

Optional (for deployment):
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DOCKER_HUB_USERNAME`
- `DOCKER_HUB_TOKEN`

### 3. Configure Codecov (Optional)

1. Sign up at [codecov.io](https://codecov.io)
2. Connect your GitHub repository
3. Get your upload token
4. Add `CODECOV_TOKEN` to GitHub secrets

### 4. Branch Protection Rules

Recommended settings for `main` branch:

**Settings > Branches > Add rule**

- ✅ Require pull request reviews (1 reviewer)
- ✅ Require status checks to pass
  - backend-tests
  - frontend-tests
  - build-docker
- ✅ Require branches to be up to date
- ✅ Require conversation resolution

---

## 📊 Status Badges

Add these to your README.md:

```markdown
![CI/CD Pipeline](https://github.com/abanoubmedhat/feedback_analyzer/workflows/CI%2FCD%20Pipeline/badge.svg)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen)
![Coverage](https://codecov.io/gh/abanoubmedhat/feedback_analyzer/branch/main/graph/badge.svg)
```

---

## 🔍 Monitoring Pipeline Results

### View Workflow Runs
1. Go to **Actions** tab in GitHub
2. Click on a workflow name
3. View job details and logs

### Check Coverage Reports
- Codecov dashboard: `https://codecov.io/gh/abanoubmedhat/feedback_analyzer`
- Local HTML reports in `backend/htmlcov/` and `frontend/coverage/`

### Security Alerts
- Go to **Security > Code scanning alerts**
- Review Trivy scan results

---

## 🚀 Deployment Options

The pipeline includes a staging deployment step. Configure for your platform:

### AWS ECS
```yaml
- name: Deploy to ECS
  uses: aws-actions/amazon-ecs-deploy-task-definition@v1
  with:
    task-definition: task-definition.json
    service: feedback-analyzer
    cluster: production
```

### Google Cloud Run
```yaml
- name: Deploy to Cloud Run
  uses: google-github-actions/deploy-cloudrun@v2
  with:
    service: feedback-analyzer
    image: gcr.io/project/feedback-analyzer:${{ github.sha }}
```

### Azure App Service
```yaml
- name: Deploy to Azure
  uses: azure/webapps-deploy@v2
  with:
    app-name: feedback-analyzer
    images: 'registry.azurecr.io/feedback-analyzer:${{ github.sha }}'
```

### DigitalOcean
```yaml
- name: Deploy to DigitalOcean
  uses: digitalocean/app_action@v1
  with:
    app_name: feedback-analyzer
    token: ${{ secrets.DIGITALOCEAN_TOKEN }}
```

### Heroku
```yaml
- name: Deploy to Heroku
  uses: akhileshns/heroku-deploy@v3.12.12
  with:
    heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
    heroku_app_name: feedback-analyzer
    heroku_email: your-email@example.com
```

---

## 🐛 Troubleshooting

### Tests Fail in CI but Pass Locally

**Cause:** Environment differences (paths, dependencies, timing)

**Solutions:**
- Check Python/Node versions match
- Verify all dependencies in requirements.txt/package.json
- Add debug logging to failing tests
- Run tests in Docker locally: `docker-compose exec backend pytest -v`

### Docker Build Fails

**Cause:** Missing files, permission issues, or cache problems

**Solutions:**
- Check `.dockerignore` files
- Clear Docker cache: Use `--no-cache` flag
- Verify file paths are correct
- Check Dockerfile syntax

### Coverage Upload Fails

**Cause:** Missing Codecov token or incorrect file paths

**Solutions:**
- Verify `CODECOV_TOKEN` secret is set
- Check coverage report paths
- Ensure coverage files are generated

### Deployment Fails

**Cause:** Missing credentials or incorrect configuration

**Solutions:**
- Verify all deployment secrets are set
- Check environment configuration
- Test deployment steps locally first
- Review deployment logs in Actions tab

---

## 📈 Performance Optimization

### Speed Up CI/CD

1. **Use Caching**
   - ✅ Already enabled for pip and npm
   - ✅ Docker layer caching enabled

2. **Parallel Jobs**
   - ✅ Backend and frontend tests run in parallel
   - ✅ Build and security scan run concurrently

3. **Fail Fast**
   - Add `fail-fast: true` to job matrices
   - Use `continue-on-error: false`

4. **Selective Testing**
   - Run only changed file tests on PRs
   - Use path filters in workflow triggers

### Example: Path-based Triggers
```yaml
on:
  push:
    paths:
      - 'backend/**'
      - '.github/workflows/ci-cd.yml'
```

---

## 📝 Best Practices

### ✅ Do's
- ✅ Keep workflows simple and focused
- ✅ Use official actions when possible
- ✅ Cache dependencies
- ✅ Fail fast on critical errors
- ✅ Use secrets for sensitive data
- ✅ Test workflows on feature branches first

### ❌ Don'ts
- ❌ Don't commit secrets to code
- ❌ Don't run expensive tests on every commit
- ❌ Don't deploy without tests passing
- ❌ Don't use outdated action versions
- ❌ Don't ignore security warnings

---

## 🎯 Next Steps

1. **Enable Actions**: Push workflow files to enable
2. **Add Secrets**: Configure required secrets
3. **Test Pipeline**: Create a test PR to verify
4. **Monitor**: Check Actions tab for results
5. **Iterate**: Improve based on feedback

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Codecov Documentation](https://docs.codecov.com/)
- [Trivy Security Scanner](https://github.com/aquasecurity/trivy)

---

## 🆘 Support

If you encounter issues:

1. Check **Actions** tab for detailed logs
2. Review this documentation
3. Check GitHub Actions community forums
4. Open an issue in the repository

---

**Status**: ✅ CI/CD Pipeline Ready for Production
**Last Updated**: November 13, 2025
