# Railway Deployment Guide

This guide will help you deploy the Infinite Chess backend to Railway.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app) (free tier includes $5/month credit)
2. **GitHub Repository**: Your code should be in a GitHub repository

## Step 1: Create a New Project on Railway

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account if prompted
5. Select your repository (`kesav-v.github.io`)

## Step 2: Configure the Service

Railway should auto-detect your Flask app, but you may need to configure:

1. **Root Directory**: Set to `server` (since your Flask app is in the `server/` folder)
2. **Start Command**: Should be `python app.py` (already in Procfile)
3. **Port**: Railway will automatically set the `PORT` environment variable

## Step 3: Set Environment Variables (Optional)

If you need any environment variables, you can set them in Railway:
- Go to your service → **Variables** tab
- Add any custom variables (currently none are required)

## Step 4: Deploy

1. Railway will automatically start building and deploying
2. Watch the build logs to ensure everything works
3. Once deployed, Railway will provide a public URL (e.g., `https://your-app.railway.app`)

## Step 5: Update Frontend API URL

After deployment, you'll need to update your frontend to point to the Railway backend:

1. **Get your Railway URL**: It will be something like `https://your-app-name.railway.app`

2. **Update `src/config.ts`**:
   ```typescript
   export const API_BASE_URL = 
     process.env.REACT_APP_API_URL || 
     process.env.NODE_ENV === 'production' 
       ? "https://your-app-name.railway.app"  // Replace with your Railway URL
       : "http://localhost:8080";
   ```

3. **For GitHub Pages deployment**, you have two options:
   
   **Option A: Hardcode the URL** (simplest)
   - Just replace `"https://your-railway-app.railway.app"` in `src/config.ts` with your actual Railway URL
   
   **Option B: Use environment variable** (more flexible)
   - Set `REACT_APP_API_URL` in your GitHub Actions or build process
   - The config file will automatically use it

4. **CORS is already configured**: The Flask app has `CORS(app)` which allows all origins. For production, you might want to restrict this to your GitHub Pages domain.

## Step 6: Configure Custom Domain (Optional)

1. Go to your service → **Settings** → **Domains**
2. Add a custom domain if you have one
3. Railway will provide DNS instructions

## Important Notes

### Database Persistence

- **SQLite (default)**: Works for local development, but data is lost on Railway redeploys
- **PostgreSQL (recommended)**: Persistent, managed database that survives deployments
  - See `server/POSTGRES_SETUP.md` for setup instructions
  - Just add a PostgreSQL service in Railway - it's automatic!
  - Code automatically uses PostgreSQL when `DATABASE_URL` is set
  - Local development still uses SQLite (no setup needed)

### Free Tier Limits

- **$5/month credit** (usually enough for a small Flask app)
- **512 MB RAM** default
- **1 GB storage**
- Monitor usage in Railway dashboard

### Monitoring

- Check logs in Railway dashboard
- Set up alerts if needed
- Monitor resource usage

## Troubleshooting

### Build Fails

- Check that `requirements.txt` is in the `server/` directory
- Verify Python version (Railway auto-detects, but you can specify in `runtime.txt`)

### App Won't Start

- Check logs in Railway dashboard
- Verify `PORT` environment variable is being used (it's set automatically)
- Ensure `Procfile` is correct

### CORS Errors

- Make sure `flask-cors` is in `requirements.txt`
- Verify CORS is enabled in `app.py` (it is: `CORS(app)`)
- Check that your frontend URL is allowed

### Database Issues

- SQLite should work out of the box
- If you need persistent storage, Railway provides a volume
- For production, consider PostgreSQL

## Updating Your Deployment

Railway automatically deploys when you push to your main branch. To update:

1. Make your changes
2. Commit and push to GitHub
3. Railway will automatically rebuild and redeploy

## Cost Estimation

- **Free tier**: $5/month credit
- **Estimated cost**: ~$0-5/month for a small Flask app
- **If you exceed free tier**: Pay-as-you-go pricing

## Next Steps

1. Deploy to Railway
2. Update frontend API URL
3. Test the full application
4. Consider adding a custom domain
5. Set up monitoring/alerts if needed

