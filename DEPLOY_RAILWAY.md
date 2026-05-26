# Quick Railway Deployment Guide

## Option 1: Deploy via Railway Web Interface (Recommended - 5 minutes)

1. **Go to Railway**: https://railway.app
2. **Sign up/Login** with your GitHub account
3. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway if prompted
   - Select your repository: `kesav-v/kesav-v.github.io`
4. **Configure Service**:
   - Railway will auto-detect the Flask app
   - **IMPORTANT**: Set the **Root Directory** to `server`
     - Click on the service → Settings → Root Directory → Set to `server`
   - The start command should be `python app.py` (already in Procfile)
5. **Deploy**:
   - Railway will automatically start building
   - Watch the logs to ensure it builds successfully
6. **Get Your URL**:
   - Once deployed, Railway will provide a URL like `https://your-app-name.railway.app`
   - Copy this URL!

## Option 2: Deploy via Railway CLI

If you prefer the CLI:

```bash
# 1. Login (opens browser)
railway login

# 2. Initialize project
cd server
railway init

# 3. Link to existing project or create new
railway link

# 4. Deploy
railway up
```

## After Deployment

1. **Get your Railway URL** (e.g., `https://your-app-name.railway.app`)

2. **Update `src/config.ts`**:
   ```typescript
   export const API_BASE_URL = 
     process.env.REACT_APP_API_URL || 
     process.env.NODE_ENV === 'production' 
       ? "https://your-app-name.railway.app"  // Replace with your actual Railway URL
       : "http://localhost:8080";
   ```

3. **Redeploy frontend**:
   ```bash
   npm run deploy
   ```

## Troubleshooting

- **Build fails**: Check that `requirements.txt` is in the `server/` directory
- **App won't start**: Check logs in Railway dashboard, ensure PORT env variable is set (Railway does this automatically)
- **CORS errors**: The Flask app already has `CORS(app)` enabled, so this should work

## Cost

- Free tier: $5/month credit (usually enough for a small Flask app)
- Monitor usage in Railway dashboard

