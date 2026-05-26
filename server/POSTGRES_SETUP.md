# Setting Up PostgreSQL on Railway

This guide will help you set up a PostgreSQL database on Railway for persistent game storage.

## Why PostgreSQL?

- **Persistent**: Data survives deployments and restarts
- **Managed**: Railway handles backups, scaling, and maintenance
- **Free tier**: Railway's free tier includes PostgreSQL
- **No complexity**: Works automatically - just add the service

## Setup Steps

### 1. Add PostgreSQL Service to Your Railway Project

1. Go to your Railway project dashboard
2. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically:
   - Create a PostgreSQL database
   - Set the `DATABASE_URL` environment variable
   - Link it to your Flask service

### 2. That's It!

The code automatically detects `DATABASE_URL` and uses PostgreSQL. No code changes needed!

## How It Works

- **Local Development**: No `DATABASE_URL` → Uses SQLite (simple, no setup)
- **Railway Production**: `DATABASE_URL` exists → Uses PostgreSQL (persistent, managed)

## Verification

After adding PostgreSQL:

1. Check your Flask service's **Variables** tab
2. You should see `DATABASE_URL` automatically set
3. Deploy your app (or it will auto-deploy)
4. The database will be initialized automatically on first run

## Local Development

**You don't need to change anything!** 

- Keep using SQLite locally (no PostgreSQL needed)
- Just run `python app.py` as usual
- The code automatically uses SQLite when `DATABASE_URL` is not set

## Cost

- **Free tier**: Railway's free tier includes PostgreSQL
- **Usage**: Small apps typically stay within free tier limits
- **Monitor**: Check usage in Railway dashboard

## Troubleshooting

### Database Connection Errors

- Verify `DATABASE_URL` is set in Railway dashboard
- Check that PostgreSQL service is running
- Ensure your Flask service is linked to the PostgreSQL service

### Migration from SQLite

If you had data in SQLite:
- The new PostgreSQL database starts fresh
- Old SQLite data won't migrate automatically
- This is fine for most use cases (games are ephemeral)

### Local Testing with PostgreSQL (Optional)

If you want to test PostgreSQL locally:

1. Install PostgreSQL locally
2. Create a database
3. Set `DATABASE_URL` environment variable:
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/chess_games"
   ```

But this is **not necessary** - SQLite works fine for local development!

