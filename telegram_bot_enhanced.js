import "dotenv/config";
import { Telegraf } from "telegraf";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}

const OWNER_NAME = process.env.OWNER_NAME || "Clinic Director";
const CLINIC_NAME = process.env.CLINIC_NAME || "Our Hospital";
const CITY = process.env.CITY || "Abuja";

const bot = new Telegraf(token);

// --- Enhanced helpers ---
const menu = () => [
  `Hi, I'm SerenityBot for ${CLINIC_NAME} (${CITY}).`,
  "",
  "🏥 1) Book appointment",
  "❓ 2) FAQs", 
  "👨‍⚕️ 3) Talk to staff",
  "",
  "You can also send images, PDFs, voice notes or videos. I will reply in text."
].join("\n");

function looksLikeBooking(text = "") {
  // Enhanced booking detection
  const bookingKeywords = ['book', 'appointment', 'schedule', 'visit'];
  const hasComma = text.includes(",");
  const hasBookingKeyword = bookingKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  );
  // Check for name-like pattern with comma and time/date
  const nameTimePattern = /^[a-zA-Z\s]+,\s*[a-zA-Z0-9\s:]+$/;
  
  return hasComma || hasBookingKeyword || nameTimePattern.test(text);
}

function bookingReply(text = "") {
  // Enhanced booking acknowledgment
  return [
    "✅ Booking request received!",
    "",
    `Request: "${text}"`,
    "",
    "A staff member will contact you shortly to confirm your appointment.",
    "Please ensure your phone number is available for confirmation."
  ].join("\n");
}

function validateBookingFormat(text = "") {
  // Basic validation for booking format
  const parts = text.split(",");
  if (parts.length >= 2) {
    const name = parts[0].trim();
    const timeSlot = parts[1].trim();
    
    if (name.length > 2 && timeSlot.length > 2) {
      return { valid: true, name, timeSlot };
    }
  }
  return { valid: false };
}

// --- Error handling wrapper ---
const safeHandler = (handler) => {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      console.error('Bot error:', error);
      await ctx.reply("Sorry, something went wrong. Please try again or contact our staff directly.");
    }
  };
};

// --- Commands ---
bot.start(safeHandler((ctx) => ctx.reply(menu())));

bot.help(safeHandler((ctx) => 
  ctx.reply([
    "🆘 Help Menu:",
    "",
    "• Use /menu to see main options",
    "• Send 'Full Name, Fri 3pm' to request a booking",
    "• Use /faq for frequently asked questions", 
    "• Send any media files and we'll review them",
    "",
    "For urgent matters, please call our clinic directly."
  ].join("\n"))
));

bot.command("menu", safeHandler((ctx) => ctx.reply(menu())));

bot.command("faq", safeHandler((ctx) =>
  ctx.reply([
    "📋 Frequently Asked Questions:",
    "",
    "📍 Locations:",
    "  • Galadinmawa, Abuja",
    "  • Karu, Abuja", 
    "",
    "⏰ Hours: 8am–6pm Monday–Saturday",
    "",
    "🏥 Services:",
    "  • Mental health support",
    "  • Substance-use counseling",
    "  • General consultations",
    "",
    "💳 Payment: Cash, Bank Transfer, Insurance",
    "",
    "📞 For emergencies, please call our 24/7 hotline."
  ].join("\n"))
));

// --- Text handling ---
bot.on("text", safeHandler(async (ctx) => {
  const text = (ctx.message?.text || "").trim();
  
  if (!text) return;
  
  // Owner recognition (professional, concise)
  const ownerRegex = new RegExp(OWNER_NAME, "i");
  if (ownerRegex.test(text)) {
    return ctx.reply([
      `${OWNER_NAME} is the Managing Director of ${CLINIC_NAME} in ${CITY}.`,
      "",
      "For administrative matters, please send your request and we will ensure it reaches the appropriate person.",
      "",
      "Response time: Within 2-4 business hours."
    ].join("\n"));
  }
  
  // Enhanced shortcuts
  const lowerText = text.toLowerCase();
  
  if (["1", "book", "booking", "appointment"].includes(lowerText)) {
    return ctx.reply([
      "📅 To book an appointment, please send:",
      "",
      "Format: Full Name, Preferred Date/Time",
      "",
      "Examples:",
      "• Ada Lovelace, Friday 3pm",
      "• John Doe, Tomorrow 10am", 
      "• Jane Smith, Monday morning",
      "",
      "We'll confirm availability and contact you shortly."
    ].join("\n"));
  }
  
  if (["2", "faq", "faqs", "info", "information"].includes(lowerText)) {
    return bot.telegram.sendMessage(ctx.chat.id, [
      "📋 Quick Info:",
      "",
      "📍 Locations: Galadinmawa & Karu (Abuja)",
      "⏰ Hours: 8am–6pm Mon–Sat", 
      "🏥 Services: Mental health & substance-use support",
      "",
      "Use /faq for detailed information."
    ].join("\n"));
  }
  
  if (["3", "staff", "agent", "human", "person"].includes(lowerText)) {
    return ctx.reply([
      "👨‍⚕️ Connecting you with our staff...",
      "",
      "Your message will be forwarded to our next available team member.",
      "Expected response time: 30 minutes - 2 hours during business hours.",
      "",
      "For urgent matters, please call our clinic directly."
    ].join("\n"));
  }
  
  // Enhanced booking capture
  if (looksLikeBooking(text)) {
    const validation = validateBookingFormat(text);
    
    if (validation.valid) {
      // TODO: Store in database
      console.log(`New booking request: ${validation.name} - ${validation.timeSlot}`);
      return ctx.reply(bookingReply(text));
    } else {
      return ctx.reply([
        "❌ Booking format not recognized.",
        "",
        "Please use: Full Name, Preferred Date/Time",
        "Example: 'Ada Lovelace, Friday 3pm'",
        "",
        "Or type '1' for booking instructions."
      ].join("\n"));
    }
  }
  
  // Check for common health-related keywords
  const healthKeywords = ['pain', 'sick', 'help', 'emergency', 'urgent', 'depression', 'anxiety'];
  const hasHealthKeyword = healthKeywords.some(keyword => 
    lowerText.includes(keyword)
  );
  
  if (hasHealthKeyword) {
    return ctx.reply([
      "🏥 Thank you for reaching out to us.",
      "",
      "For immediate assistance:",
      "• Type '1' to book an appointment",
      "• Type '3' to speak with our staff",
      "• Call our clinic for urgent matters",
      "",
      "We're here to support your health and wellbeing."
    ].join("\n"));
  }
  
  // Default: guided response
  return ctx.reply([
    "Thank you for contacting us. 👋",
    "",
    "I didn't quite understand your request. Here are your options:",
    "",
    "• Type /menu to see all options",
    "• Send 'Full Name, Day Time' to book appointment", 
    "• Type '3' to speak with staff",
    "• Use /help for detailed assistance"
  ].join("\n"));
}));

// --- Enhanced media intake ---
bot.on("photo", safeHandler((ctx) => 
  ctx.reply([
    "📷 Image received successfully.",
    "",
    "Our medical team will review your image and respond appropriately.",
    "Expected response time: 2-4 hours during business hours.",
    "",
    "If this is urgent, please call our clinic directly."
  ].join("\n"))
));

bot.on("document", safeHandler((ctx) => 
  ctx.reply([
    "📄 Document received successfully.",
    "",
    "We'll review your document and follow up with relevant information.",
    "Expected response time: 4-6 hours during business hours.",
    "",
    "For urgent document reviews, please call our clinic."
  ].join("\n"))
));

bot.on("video", safeHandler((ctx) => 
  ctx.reply([
    "🎥 Video received successfully.",
    "",
    "Our team will review your video content and respond accordingly.", 
    "Expected response time: 4-6 hours during business hours.",
    "",
    "For urgent matters, please contact us directly."
  ].join("\n"))
));

bot.on("voice", safeHandler((ctx) => 
  ctx.reply([
    "🎤 Voice message received successfully.",
    "",
    "We'll listen to your message and provide appropriate assistance.",
    "Expected response time: 2-4 hours during business hours.", 
    "",
    "For immediate assistance, please call our clinic."
  ].join("\n"))
));

// --- Bot lifecycle ---
bot.launch().then(() => {
  console.log(`✅ ${CLINIC_NAME} Telegram bot is running (long polling)`);
  console.log(`📍 Serving: ${CITY}`);
  console.log(`👨‍⚕️ Contact: ${OWNER_NAME}`);
}).catch((error) => {
  console.error("❌ Failed to launch bot:", error);
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  bot.stop(signal);
  process.exit(0);
};

process.once("SIGINT", () => gracefulShutdown("SIGINT"));
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});