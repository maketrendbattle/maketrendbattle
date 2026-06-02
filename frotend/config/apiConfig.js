/**
 * Rocky Axis Authentication Gateway - API Configuration Module
 * * Purpose: Centralizes active backend environment URLs.
 * Set BASE_URL directly to your live Vercel domain when deploying.
 */

export const API_CONFIG = {
  // Update this to your production Vercel URL once deployed
  BASE_URL: "https://your-backend-api.vercel.app/api",
  
  ENDPOINTS: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    FORGOT_PASSWORD: "/auth/forgot",
    SOCIAL_AUTH_FLOW: "/auth/social-flow",
    VERIFY_USERNAME: "/auth/verify-username",
    VERIFY_EMAIL: "/auth/verify-email",
    VERIFY_PHONE: "/auth/verify-phone",
    REG_CONFIG: "/config/registration",
    STATE_SUBSCRIBE: "/auth/state-subscribe"
  }
};