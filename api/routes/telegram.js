import { Telegraf } from 'telegraf';
import { env } from '../config/env.js';
import * as utils from '../lib/utils.js';
import * as llm from '../lib/llm.js';
import * as db from '../lib/supabase.js';

/**
 * Telegram Bot Routes and Logic
 * Handles all bot interactions, commands, and media processing
 */

// Create and configure Telegram bot
export function createTelegramBot() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }
  
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
  
  // Error handling wrapper
  const safeHandler = (handler) => {
    return async (ctx) => {
      try {
        await handler(ctx);
      } catch (error) {
        console.error('Bot handler error:', error);
        try {
          await ctx.reply(utils.getErrorMessage());
        } catch (replyError) {
          console.error('Failed to send error message:', replyError);
        }
      }
    };
  };
  
  // Middleware: User identification and consent check
  bot.use(safeHandler(async (ctx, next) => {
    const user = ctx.from;
    if (!user) return next();
    
    // Upsert patient record
    const patient = await db.upsertPatientByTelegramId(user.id, {
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username
    });
    
    // Store patient info in context
    ctx.patient = patient;
    ctx.consentOptIn = patient?.consent_opt_in !== false;
    
    return next();
  }));
  
  // Middleware: Chat logging (if consent given)
  bot.use(safeHandler(async (ctx, next) => {
    const result = await next();
    
    // Log the interaction if user has consented
    if (ctx.consentOptIn && ctx.patient && ctx.message) {
      const logData = {
        patient_id: ctx.patient.id,
        telegram_user_id: ctx.from.id,
        telegram_chat_id: ctx.chat.id,
        message_type: getMessageType(ctx.message),
        message_text: ctx.message.text || '',
        media_type: getMediaType(ctx.message),
        media_file_id: getMediaFileId(ctx.message),
        metadata: {
          username: ctx.from.username,
          first_name: ctx.from.first_name,
          message_id: ctx.message.message_id
        }
      };
      
      await db.logChat(logData);
    }
    
    return result;
  }));
  
  /**
   * Commands
   */
  
  // Start command
  bot.start(safeHandler(async (ctx) => {
    await ctx.reply(utils.getMainMenu());
  }));
  
  // Help command
  bot.help(safeHandler(async (ctx) => {
    await ctx.reply(utils.getHelpMenu());
  }));
  
  // Menu command
  bot.command('menu', safeHandler(async (ctx) => {
    await ctx.reply(utils.getMainMenu());
  }));
  
  // FAQ command
  bot.command('faq', safeHandler(async (ctx) => {
    await ctx.reply(utils.getFAQMenu());
  }));
  
  // Who am I command (returns user ID)
  bot.command('whoami', safeHandler(async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : 'No username';
    const name = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();
    
    await ctx.reply([
      "👤 **Your Telegram Information:**",
      "",
      `🆔 User ID: \`${userId}\``,
      `👤 Name: ${name || 'Not provided'}`,
      `📝 Username: ${username}`,
      "",
      "*Note: Your User ID can be used by clinic administrators for access control.*"
    ].join("\n"), { parse_mode: 'Markdown' });
  }));
  
  // Opt-out command (NDPR compliance)
  bot.command('optout', safeHandler(async (ctx) => {
    await db.updatePatientConsent(ctx.from.id, false);
    await ctx.reply(utils.getOptOutMessage());
  }));
  
  // Opt-in command
  bot.command('optin', safeHandler(async (ctx) => {
    await db.updatePatientConsent(ctx.from.id, true);
    await ctx.reply(utils.getOptInMessage());
  }));
  
  /**
   * MD-Only Commands (Admin Access)
   */
  
  // MD Brief - Daily statistics
  bot.command('md_brief', safeHandler(async (ctx) => {
    if (!utils.isAuthorizedMD(ctx.from.id)) {
      await ctx.reply("❌ Unauthorized. This command is restricted to clinic administrators.");
      return;
    }
    
    try {
      const briefData = await db.getDailyBrief();
      const response = [
        "📊 **Daily Brief** (Today)",
        "",
        `💬 Chats: ${briefData.chats}`,
        `📅 Bookings: ${briefData.bookings}`,
        `❌ Cancels: ${briefData.cancels}`,
        `❓ FAQs: ${briefData.faqs}`,
        "",
        `🏥 ${env.CLINIC_NAME} - ${new Date().toLocaleDateString()}`
      ].join("\n");
      
      await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in md_brief:', error);
      await ctx.reply("❌ Error retrieving daily brief. Please try again.");
    }
  }));
  
  // MD Follow-ups - Pending appointments
  bot.command('md_followups', safeHandler(async (ctx) => {
    if (!utils.isAuthorizedMD(ctx.from.id)) {
      await ctx.reply("❌ Unauthorized. This command is restricted to clinic administrators.");
      return;
    }
    
    try {
      const followups = await db.getFollowupAppointments(20);
      
      if (followups.length === 0) {
        await ctx.reply("✅ No pending follow-ups at this time.");
        return;
      }
      
      const response = [
        "📋 **Pending Follow-ups** (Top 20)",
        "",
        ...followups.map((apt, index) => 
          `${index + 1}. **${apt.full_name}** - ${apt.preferred_datetime || 'TBD'} (${apt.status})`
        ),
        "",
        `Total: ${followups.length} appointments`
      ].join("\n");
      
      await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in md_followups:', error);
      await ctx.reply("❌ Error retrieving follow-ups. Please try again.");
    }
  }));
  
  /**
   * Text Message Handling
   */
  
  bot.on('text', safeHandler(async (ctx) => {
    const text = utils.sanitizeText(ctx.message.text);
    
    if (!text) return;
    
    // Check for emergency keywords first
    if (llm.containsEmergencyKeywords(text)) {
      await ctx.reply(llm.getEmergencyResponse(), { parse_mode: 'Markdown' });
      return;
    }
    
    // Owner recognition
    const ownerRegex = new RegExp(env.OWNER_NAME, "i");
    if (ownerRegex.test(text)) {
      await ctx.reply(utils.getOwnerProfile());
      return;
    }
    
    // Shortcut handling
    const lowerText = text.toLowerCase();
    
    if (["1", "book", "booking", "appointment"].includes(lowerText)) {
      await ctx.reply(utils.getBookingInstructions());
      return;
    }
    
    if (["2", "faq", "faqs", "info", "information"].includes(lowerText)) {
      await ctx.reply(utils.getFAQMenu());
      return;
    }
    
    if (["3", "staff", "agent", "human", "person"].includes(lowerText)) {
      await ctx.reply(utils.getStaffConnectionMessage());
      return;
    }
    
    // Booking detection and processing
    if (utils.looksLikeBooking(text)) {
      const validation = utils.validateBookingFormat(text);
      
      if (validation.valid) {
        // Create appointment record
        if (ctx.patient) {
          await db.createAppointment({
            patient_id: ctx.patient.id,
            full_name: validation.name,
            preferred_datetime: validation.timeSlot,
            telegram_user_id: ctx.from.id,
            telegram_chat_id: ctx.chat.id,
            raw_request: text
          });
        }
        
        await ctx.reply(utils.getBookingReply(text));
        return;
      } else {
        await ctx.reply(utils.getInvalidBookingMessage());
        return;
      }
    }
    
    // Health-related keywords
    if (utils.hasHealthKeywords(text)) {
      await ctx.reply(utils.getHealthResponse());
      return;
    }
    
    // Use Gemini for general responses
    try {
      const aiResponse = await llm.llmTextReply(text);
      await ctx.reply(aiResponse);
    } catch (error) {
      console.error('Error getting AI response:', error);
      await ctx.reply([
        "Thank you for your message. Our team will review it and respond appropriately.",
        "",
        "For immediate assistance:",
        "• Type '1' to book an appointment",
        "• Type '2' for frequently asked questions",
        "• Type '3' to connect with staff"
      ].join("\n"));
    }
  }));
  
  /**
   * Media Handling
   */
  
  // Photo handling
  bot.on('photo', safeHandler(async (ctx) => {
    await handleMedia(ctx, 'photo', async (fileBuffer, contentType) => {
      const base64 = fileBuffer.toString('base64');
      return await llm.analyzeImage(base64, contentType);
    });
  }));
  
  // Voice message handling
  bot.on('voice', safeHandler(async (ctx) => {
    await handleMedia(ctx, 'voice', async (fileBuffer, contentType) => {
      const base64 = fileBuffer.toString('base64');
      return await llm.transcribeAudio(base64, contentType);
    });
  }));
  
  // Video note handling
  bot.on('video_note', safeHandler(async (ctx) => {
    await handleMedia(ctx, 'video_note', async (fileBuffer, contentType) => {
      const base64 = fileBuffer.toString('base64');
      return await llm.summarizeVideo(base64, contentType);
    });
  }));
  
  // Video handling
  bot.on('video', safeHandler(async (ctx) => {
    await handleMedia(ctx, 'video', async (fileBuffer, contentType) => {
      const base64 = fileBuffer.toString('base64');
      return await llm.summarizeVideo(base64, contentType);
    });
  }));
  
  // Document handling
  bot.on('document', safeHandler(async (ctx) => {
    await handleMedia(ctx, 'document', async (fileBuffer, contentType, filename) => {
      const base64 = fileBuffer.toString('base64');
      return await llm.summarizeDocument(base64, contentType, filename);
    });
  }));
  
  // Audio handling
  bot.on('audio', safeHandler(async (ctx) => {
    await handleMedia(ctx, 'audio', async (fileBuffer, contentType) => {
      const base64 = fileBuffer.toString('base64');
      return await llm.transcribeAudio(base64, contentType);
    });
  }));
  
  return bot;
}

/**
 * Helper Functions
 */

// Handle media messages
async function handleMedia(ctx, mediaType, processor) {
  try {
    let fileId, fileName, mimeType;
    
    // Extract file information based on media type
    switch (mediaType) {
      case 'photo':
        const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Get highest resolution
        fileId = photo.file_id;
        mimeType = 'image/jpeg';
        fileName = 'photo.jpg';
        break;
      case 'voice':
        fileId = ctx.message.voice.file_id;
        mimeType = ctx.message.voice.mime_type || 'audio/ogg';
        fileName = 'voice.ogg';
        break;
      case 'video_note':
        fileId = ctx.message.video_note.file_id;
        mimeType = 'video/mp4';
        fileName = 'video_note.mp4';
        break;
      case 'video':
        fileId = ctx.message.video.file_id;
        mimeType = ctx.message.video.mime_type || 'video/mp4';
        fileName = ctx.message.video.file_name || 'video.mp4';
        break;
      case 'document':
        fileId = ctx.message.document.file_id;
        mimeType = ctx.message.document.mime_type || 'application/octet-stream';
        fileName = ctx.message.document.file_name || 'document';
        break;
      case 'audio':
        fileId = ctx.message.audio.file_id;
        mimeType = ctx.message.audio.mime_type || 'audio/mpeg';
        fileName = ctx.message.audio.file_name || 'audio.mp3';
        break;
      default:
        throw new Error(`Unsupported media type: ${mediaType}`);
    }
    
    // Get file from Telegram
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    // Download file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const fileBuffer = Buffer.from(await response.arrayBuffer());
    
    // Process the media
    const analysisResult = await processor(fileBuffer, mimeType, fileName);
    
    // Send response
    await ctx.reply(analysisResult);
    
  } catch (error) {
    console.error(`Error handling ${mediaType}:`, error);
    await ctx.reply(`❌ Sorry, I couldn't process your ${mediaType}. Our staff will review it manually during your appointment.`);
  }
}

// Get message type for logging
function getMessageType(message) {
  if (message.text) return 'text';
  if (message.photo) return 'photo';
  if (message.voice) return 'voice';
  if (message.video_note) return 'video_note';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.audio) return 'audio';
  return 'other';
}

// Get media type for logging
function getMediaType(message) {
  if (message.photo) return 'image';
  if (message.voice) return 'voice';
  if (message.video_note) return 'video_note';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.audio) return 'audio';
  return null;
}

// Get media file ID for logging
function getMediaFileId(message) {
  if (message.photo) return message.photo[message.photo.length - 1].file_id;
  if (message.voice) return message.voice.file_id;
  if (message.video_note) return message.video_note.file_id;
  if (message.video) return message.video.file_id;
  if (message.document) return message.document.file_id;
  if (message.audio) return message.audio.file_id;
  return null;
}

export default createTelegramBot;