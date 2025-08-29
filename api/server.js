import express from 'express';
import { initializeEnv, env } from './config/env.js';
import { initializeSupabase } from './lib/supabase.js';
import { initializeGemini } from './lib/llm.js';
import { createTelegramBot } from './routes/telegram.js';

/**
 * Express Server for SerenityCareAI Telegram Bot
 * Handles webhook endpoints and API routes for production deployment
 */

// Initialize environment and services
initializeEnv();
initializeSupabase();
initializeGemini();

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    clinic: env.CLINIC_NAME,
    city: env.CITY,
    mode: env.IS_WEBHOOK_MODE ? 'webhook' : 'polling',
    services: {
      telegram: !!env.TELEGRAM_BOT_TOKEN,
      supabase: !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
      gemini: !!env.GEMINI_API_KEY
    }
  };
  
  res.json(healthStatus);
});

// Initialize Telegram bot
let bot = null;
try {
  bot = createTelegramBot();
  console.log('✅ Telegram bot created successfully');
} catch (error) {
  console.error('❌ Failed to create Telegram bot:', error);
  process.exit(1);
}

// Webhook endpoint for Telegram
app.post('/api/telegram/webhook', (req, res) => {
  if (!bot) {
    console.error('Bot not initialized');
    return res.status(500).json({ error: 'Bot not initialized' });
  }
  
  try {
    // Use Telegraf's webhook callback
    const webhookCallback = bot.webhookCallback('/api/telegram/webhook');
    webhookCallback(req, res);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// MD-only API endpoints for analytics
app.get('/api/md/brief', async (req, res) => {
  try {
    // Simple IP-based or API key auth (in production, use proper auth)
    const authHeader = req.headers.authorization;
    const apiKey = authHeader?.replace('Bearer ', '');
    
    // For now, just check if MD_TELEGRAM_USER_ID is configured
    if (!env.MD_TELEGRAM_USER_ID) {
      return res.status(403).json({ error: 'Unauthorized - MD access not configured' });
    }
    
    // Import getDailyBrief dynamically to avoid circular imports
    const { getDailyBrief } = await import('./lib/supabase.js');
    const briefData = await getDailyBrief();
    
    res.json({
      date: new Date().toISOString().split('T')[0],
      clinic: env.CLINIC_NAME,
      ...briefData
    });
    
  } catch (error) {
    console.error('Error in /api/md/brief:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/md/followups', async (req, res) => {
  try {
    if (!env.MD_TELEGRAM_USER_ID) {
      return res.status(403).json({ error: 'Unauthorized - MD access not configured' });
    }
    
    const { getFollowupAppointments } = await import('./lib/supabase.js');
    const followups = await getFollowupAppointments(20);
    
    res.json({
      count: followups.length,
      appointments: followups
    });
    
  } catch (error) {
    console.error('Error in /api/md/followups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Appointments due today endpoint
app.get('/api/appointments/due-today', async (req, res) => {
  try {
    if (!env.MD_TELEGRAM_USER_ID) {
      return res.status(403).json({ error: 'Unauthorized - MD access not configured' });
    }
    
    const { getAppointmentsByStatus } = await import('./lib/supabase.js');
    const pending = await getAppointmentsByStatus('pending');
    
    // Filter for today's appointments (basic implementation)
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = pending.filter(apt => 
      apt.preferred_datetime && apt.preferred_datetime.includes(today)
    );
    
    res.json({
      date: today,
      count: todayAppointments.length,
      appointments: todayAppointments
    });
    
  } catch (error) {
    console.error('Error in /api/appointments/due-today:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Catch-all for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: [
      'GET /api/health',
      'POST /api/telegram/webhook',
      'GET /api/md/brief',
      'GET /api/md/followups',
      'GET /api/appointments/due-today'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
const PORT = env.PORT;

async function startServer() {
  try {
    // Set webhook if in production with base URL
    if (env.IS_WEBHOOK_MODE && bot) {
      console.log(`🔗 Setting webhook to: ${env.WEBHOOK_URL}`);
      await bot.telegram.setWebhook(env.WEBHOOK_URL);
      console.log('✅ Webhook configured successfully');
    } else {
      console.log('📡 Skipping webhook setup (using polling mode)');
    }
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🏥 ${env.CLINIC_NAME} Telegram Bot Server`);
      console.log(`📍 Environment: ${env.NODE_ENV}`);
      console.log(`🤖 Mode: ${env.IS_WEBHOOK_MODE ? 'Webhook' : 'Polling'}`);
      
      if (env.IS_WEBHOOK_MODE) {
        console.log(`🔗 Webhook URL: ${env.WEBHOOK_URL}`);
      }
      
      console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
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

// Start the server
startServer();

export default app;