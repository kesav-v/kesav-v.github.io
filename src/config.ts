// API Configuration
// For local development: "http://localhost:8080"
// For production: Your Railway URL (e.g., "https://your-app.railway.app")
export const API_BASE_URL = 
  process.env.REACT_APP_API_URL || 
  process.env.NODE_ENV === 'production' 
    ? "https://your-railway-app.railway.app"  // TODO: Replace with your Railway URL
    : "http://localhost:8080";

