// API Configuration
// For local development: "http://localhost:8080"
// For production: Railway backend URL
export const API_BASE_URL = 
  process.env.REACT_APP_API_URL || 
  process.env.NODE_ENV === 'production' 
    ? "https://kesav-vgithubio-production.up.railway.app"
    : "http://localhost:8080";

