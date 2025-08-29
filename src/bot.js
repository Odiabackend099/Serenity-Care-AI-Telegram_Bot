import { initializeEnv } from '../api/config/env.js';
import { initializeSupabase } from '../api/lib/supabase.js';
import { initializeGemini } from '../api/lib/llm.js';
import { createTelegramBot } from '../api/routes/telegram.js';

/**
 * Local Development Bot (Polling Mode)
 * Uses the same modules as the production webhook server
 */

async function startBot() {
  console.log('🤖 Starting SerenityCareAI Telegram Bot (Development/Polling Mode)');
  
  // Initialize environment and services
  const env = initializeEnv();
  initializeSupabase();
  initializeGemini();
  
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not configured');
    console.error('Please check your .env file');
    process.exit(1);
  }
  
  try {
    // Create bot instance
    const bot = createTelegramBot();
    
    // Start polling
    console.log('📡 Starting polling...');
    await bot.launch();
    
    console.log('✅ Bot is running in polling mode');
    console.log(`🏥 Serving ${env.CLINIC_NAME} (${env.CITY})`);
    console.log('💬 Send /start to the bot to test');
    console.log('🛑 Press Ctrl+C to stop');
    
    // Graceful shutdown
    process.once('SIGINT', () => {
      console.log('\n🛑 Stopping bot...');
      bot.stop('SIGINT');
    });
    
    process.once('SIGTERM', () => {
      console.log('\n🛑 Stopping bot...');
      bot.stop('SIGTERM');
    });
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the bot
startBot();