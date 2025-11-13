# 🚀 Deployment Guide - Free Hosting Options

This guide covers deploying your Feedback Analyzer app to free hosting platforms suitable for demos and testing.

## 📋 Table of Contents
- [Option 1: Render.com (Recommended) ⭐](#option-1-rendercom-recommended-)
- [Option 2: Railway.app](#option-2-railwayapp)
- [Option 3: Fly.io](#option-3-flyio)
- [Comparison Table](#comparison-table)

---

## Option 1: Render.com (Recommended) ⭐

**Best for:** Quick deployment with minimal configuration, PostgreSQL included

### Free Tier Limits
- ✅ Free PostgreSQL database (90 days, then expires)
- ✅ Free web services (750 hours/month)
- ✅ Auto-deploy from GitHub
- ⚠️ Services spin down after 15 min inactivity (cold start ~30s)

### Step-by-Step Deployment

#### 1. Prepare Your Repository

First, create production-ready Dockerfiles:

**Backend Dockerfile (already exists):**
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Frontend Production Dockerfile:**
Create `frontend/Dockerfile.prod`:
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Nginx Configuration:**
Create `frontend/nginx.conf`:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

**Update Frontend API URL:**
Create `frontend/.env.production`:
```env
VITE_API_URL=https://your-backend-name.onrender.com
```

#### 2. Push to GitHub

```bash
git add .
git commit -m "Add production deployment configs"
git push origin main
```

#### 3. Deploy on Render

1. **Sign up**: Go to [render.com](https://render.com) and sign up with GitHub
2. **Create PostgreSQL Database**:
   - Click "New +" → "PostgreSQL"
   - Name: `feedback-analyzer-db`
   - Free plan
   - Note the Internal Database URL

3. **Deploy Backend**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     - **Name**: `feedback-analyzer-backend`
     - **Region**: Choose closest to you
     - **Branch**: `main`
     - **Root Directory**: `backend`
     - **Runtime**: `Docker`
     - **Plan**: `Free`
   - Environment Variables:
     ```
     DATABASE_URL=<Internal Database URL from step 2>
     GOOGLE_API_KEY=<your-gemini-api-key>
     SECRET_KEY=<generate-random-string>
     ACCESS_TOKEN_EXPIRE_MINUTES=60
     ADMIN_USERNAME=admin
     ADMIN_PASSWORD=<choose-secure-password>
     ALLOWED_ORIGINS=https://your-frontend-name.onrender.com
     ```
   - Click "Create Web Service"

4. **Deploy Frontend**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     - **Name**: `feedback-analyzer-frontend`
     - **Region**: Same as backend
     - **Branch**: `main`
     - **Root Directory**: `frontend`
     - **Runtime**: `Docker`
     - **Dockerfile Path**: `frontend/Dockerfile.prod`
     - **Plan**: `Free`
   - Environment Variables:
     ```
     VITE_API_URL=https://feedback-analyzer-backend.onrender.com
     ```
   - Click "Create Web Service"

5. **Update CORS Settings**:
   - Go back to backend service
   - Update `ALLOWED_ORIGINS` to match your frontend URL
   - Redeploy

#### 4. Access Your App

- **Frontend**: `https://feedback-analyzer-frontend.onrender.com`
- **Backend API**: `https://feedback-analyzer-backend.onrender.com`
- **Database**: Managed by Render (internal only)

⚠️ **Important**: Free tier services sleep after 15 minutes of inactivity. First request will take ~30 seconds to wake up.

---

## Option 2: Railway.app

**Best for:** Generous free tier with $5/month credit, faster than Render

### Free Tier Limits
- ✅ $5 credit/month (~500 hours)
- ✅ PostgreSQL included
- ✅ No sleep/cold starts
- ✅ Custom domains

### Quick Deployment

1. **Sign up**: [railway.app](https://railway.app)
2. **Deploy from GitHub**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
3. **Add PostgreSQL**:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway auto-configures DATABASE_URL
4. **Configure Services**:
   - Railway auto-detects Dockerfiles
   - Add environment variables (same as Render)
5. **Generate Domain**:
   - Click service → Settings → Generate Domain

**Advantages over Render:**
- No cold starts
- Better performance
- More generous free tier (while credits last)

**Disadvantages:**
- Free tier expires when $5 credit runs out
- Requires payment method after trial

---

## Option 3: Fly.io

**Best for:** Global edge deployment, best performance

### Free Tier Limits
- ✅ 3 shared VMs (256MB RAM each)
- ✅ 3GB persistent storage
- ✅ 160GB outbound data
- ✅ No cold starts

### Deployment Steps

1. **Install Fly CLI**:
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Login**:
   ```bash
   fly auth login
   ```

3. **Deploy Backend**:
   ```bash
   cd backend
   fly launch --name feedback-analyzer-backend
   # Follow prompts, select region
   fly secrets set GOOGLE_API_KEY="your-key" SECRET_KEY="random-string"
   fly deploy
   ```

4. **Deploy Frontend**:
   ```bash
   cd ../frontend
   fly launch --name feedback-analyzer-frontend --dockerfile Dockerfile.prod
   fly deploy
   ```

5. **Create PostgreSQL**:
   ```bash
   fly postgres create --name feedback-analyzer-db
   fly postgres attach --app feedback-analyzer-backend feedback-analyzer-db
   ```

**Advantages:**
- Best performance (global edge network)
- No cold starts
- More control

**Disadvantages:**
- More complex setup
- Command-line focused
- Requires credit card (not charged on free tier)

---

## Comparison Table

| Feature | Render.com ⭐ | Railway.app | Fly.io |
|---------|-------------|-------------|--------|
| **Setup Difficulty** | Easy ✅ | Easy ✅ | Medium ⚠️ |
| **Free Tier** | Unlimited time | $5/month credit | 3 VMs free forever |
| **PostgreSQL** | Yes (90 days) | Yes | Yes |
| **Cold Starts** | Yes (~30s) | No ❌ | No ❌ |
| **Auto Deploy** | GitHub integration | GitHub integration | Manual/GitHub Actions |
| **Custom Domain** | Yes | Yes | Yes |
| **Performance** | Medium | Good | Excellent |
| **Credit Card** | Not required | Required after trial | Required (not charged) |
| **Best For** | Quick demos | Active development | Production-like demos |

---

## 🎯 Recommendation

### For Your Use Case (Demo Purpose):

**Choose Render.com** because:
1. ✅ No credit card required
2. ✅ Easiest setup (5 minutes)
3. ✅ GitHub auto-deploy
4. ✅ Good enough for demos
5. ✅ Built-in PostgreSQL
6. ✅ Free forever (with limitations)

**Accept the trade-off:**
- First request takes 30s (after 15min inactivity)
- This is fine for demos and portfolio projects

---

## 📝 Post-Deployment Checklist

After deploying to any platform:

- [ ] Test admin login
- [ ] Submit sample feedback in multiple languages
- [ ] Check dashboard statistics
- [ ] Verify Gemini AI analysis works
- [ ] Test product management
- [ ] Check mobile responsiveness
- [ ] Monitor error logs
- [ ] Set up uptime monitoring (e.g., [UptimeRobot](https://uptimerobot.com))

---

## 🔧 Environment Variables Reference

Required for all platforms:

```env
# Database (auto-configured on Render/Railway)
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# Google Gemini AI
GOOGLE_API_KEY=AIzaSy... (get from Google AI Studio)

# JWT Authentication
SECRET_KEY=<generate-with: openssl rand -hex 32>
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secure-password>
ADMIN_FORCE_RESET=false

# CORS (update with your frontend URL)
ALLOWED_ORIGINS=https://your-frontend.onrender.com
```

---

## 🚨 Troubleshooting

### Backend won't start
- Check DATABASE_URL format
- Verify GOOGLE_API_KEY is valid
- Check logs: `render logs` or Railway dashboard

### Frontend can't connect to backend
- Verify VITE_API_URL in frontend env
- Check ALLOWED_ORIGINS in backend env
- Inspect browser console for CORS errors

### Cold starts too slow (Render)
- Consider upgrading to paid tier ($7/month, no cold starts)
- Or switch to Railway/Fly.io

### Database connection issues
- Ensure PostgreSQL service is running
- Check connection string format
- Verify database credentials

---

## 💡 Tips for Better Performance

1. **Keep Services Warm** (Render free tier):
   - Use [cron-job.org](https://cron-job.org) to ping your app every 10 minutes
   - Prevents cold starts

2. **Optimize Docker Images**:
   - Use multi-stage builds (already in Dockerfile.prod)
   - Minimize layers
   - Use Alpine images

3. **Enable Caching**:
   - Frontend: Already has nginx gzip compression
   - Backend: Add Redis for session caching (paid tier)

4. **Monitor Your App**:
   - Set up [UptimeRobot](https://uptimerobot.com) (free)
   - Get alerts when service goes down
   - 5-minute checks keep Render warm

---

## 🎓 Next Steps

After deploying your demo:

1. Share the URL in your portfolio/resume
2. Add to GitHub README with "Live Demo" badge
3. Consider upgrading if you get real users
4. Set up CI/CD for automatic deployments
5. Add monitoring and analytics

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Fly.io Documentation](https://fly.io/docs)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices)
- [Nginx Configuration Guide](https://nginx.org/en/docs)

---

**Need help?** Check the troubleshooting section or create an issue in the repository.
