import 'dotenv/config';

/**
 * Environment Configuration and Validation
 * Validates required environment variables and provides defaults
 */

// Required environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'SUPABASE_URL', 
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY'
];

// Validate environment variables
function validateEnv() {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => console.error(`  - ${envVar}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
}

// Environment configuration object
export const env = {
  // General
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '7860', 10),
  APP_BASE_URL: process.env.APP_BASE_URL || '',
  
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  
  // Clinic Information
  OWNER_NAME: process.env.OWNER_NAME || 'Dr. Kunle Adesina',
  CLINIC_NAME: process.env.CLINIC_NAME || 'Serenity Royale Hospital',
  CITY: process.env.CITY || 'Abuja',
  
  // Admin Access
  MD_TELEGRAM_USER_ID: process.env.MD_TELEGRAM_USER_ID ? parseInt(process.env.MD_TELEGRAM_USER_ID, 10) : null,
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'incoming-media',
  
  // Gemini AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  
  // Computed values
  get IS_PRODUCTION() { return this.NODE_ENV === 'production'; },
  get IS_WEBHOOK_MODE() { return this.IS_PRODUCTION && this.APP_BASE_URL; },
  get WEBHOOK_URL() { return this.APP_BASE_URL ? `${this.APP_BASE_URL}/api/telegram/webhook` : ''; }
};

// Initialize and validate environment
export function initializeEnv() {
  console.log(`🚀 Starting SerenityCareAI Telegram Bot`);
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🏥 Clinic: ${env.CLINIC_NAME} (${env.CITY})`);
  console.log(`🤖 Mode: ${env.IS_WEBHOOK_MODE ? 'Webhook' : 'Polling'}`);
  
  if (env.IS_PRODUCTION) {
    validateEnv();
  } else {
    console.log('⚠️  Development mode: skipping strict validation');
  }
  
  return env;
}

export default env;