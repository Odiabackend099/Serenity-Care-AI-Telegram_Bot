import { env } from '../config/env.js';

/**
 * Utility Functions for Telegram Bot
 * Menus, sanitizers, owner profile, and common helpers
 */

// Main menu text generator
export function getMainMenu() {
  return [
    `Hi, I'm SerenityBot for ${env.CLINIC_NAME} (${env.CITY}).`,
    "",
    "🏥 1) Book appointment",
    "❓ 2) FAQs", 
    "👨‍⚕️ 3) Talk to staff",
    "",
    "You can also send images, PDFs, voice notes or videos. I will reply in text."
  ].join("\n");
}

// FAQ menu
export function getFAQMenu() {
  return [
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
  ].join("\n");
}

// Help menu
export function getHelpMenu() {
  return [
    "🆘 Help Menu:",
    "",
    "• Use /menu to see main options",
    "• Send 'Full Name, Fri 3pm' to request a booking",
    "• Use /faq for frequently asked questions", 
    "• Send any media files and we'll review them",
    "",
    "For urgent matters, please call our clinic directly."
  ].join("\n");
}

// Booking instructions
export function getBookingInstructions() {
  return [
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
  ].join("\n");
}

// Staff connection message
export function getStaffConnectionMessage() {
  return [
    "👨‍⚕️ Connecting you with our staff...",
    "",
    "Your message will be forwarded to our next available team member.",
    "Expected response time: 30 minutes - 2 hours during business hours.",
    "",
    "For urgent matters, please call our clinic directly."
  ].join("\n");
}

// Owner profile response
export function getOwnerProfile() {
  return [
    `${env.OWNER_NAME} is the Managing Director of ${env.CLINIC_NAME} in ${env.CITY}.`,
    "",
    "For administrative matters, please send your request and we will ensure it reaches the appropriate person.",
    "",
    "Response time: Within 2-4 business hours."
  ].join("\n");
}

// Booking detection
export function looksLikeBooking(text = "") {
  if (!text || typeof text !== 'string') return false;
  
  const bookingKeywords = ['book', 'appointment', 'schedule', 'visit'];
  const hasComma = text.includes(",");
  const hasBookingKeyword = bookingKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  );
  
  // Check for name-like pattern with comma and time/date
  const nameTimePattern = /^[a-zA-Z\s]+,\s*[a-zA-Z0-9\s:]+$/;
  
  return hasComma || hasBookingKeyword || nameTimePattern.test(text);
}

// Validate booking format
export function validateBookingFormat(text = "") {
  if (!text || typeof text !== 'string') return { valid: false };
  
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

// Booking acknowledgment
export function getBookingReply(text = "") {
  return [
    "✅ Booking request received!",
    "",
    `Request: "${text}"`,
    "",
    "A staff member will contact you shortly to confirm your appointment.",
    "Please ensure your phone number is available for confirmation."
  ].join("\n");
}

// Invalid booking format message
export function getInvalidBookingMessage() {
  return [
    "❌ Booking format not recognized.",
    "",
    "Please use: Full Name, Preferred Date/Time",
    "Example: 'Ada Lovelace, Friday 3pm'",
    "",
    "Or type '1' for booking instructions."
  ].join("\n");
}

// Text sanitization
export function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Remove potential XSS and keep it simple
  return text
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .substring(0, 2000); // Limit length
}

// Check if user is admin/MD
export function isAuthorizedMD(userId) {
  return env.MD_TELEGRAM_USER_ID && userId === env.MD_TELEGRAM_USER_ID;
}

// Format error message
export function getErrorMessage() {
  return "Sorry, something went wrong. Please try again or contact our staff directly.";
}

// Opt-out confirmation message
export function getOptOutMessage() {
  return [
    "✅ You have opted out of data collection.",
    "",
    "We will no longer log your messages for improvement purposes.",
    "You can still use the bot normally, but your conversations won't be stored.",
    "",
    "To opt back in, send /optin anytime."
  ].join("\n");
}

// Opt-in confirmation message  
export function getOptInMessage() {
  return [
    "✅ You have opted back into data collection.",
    "",
    "Your messages will now be logged to help us improve our service.",
    "This data is kept secure and used only for service improvement.",
    "",
    "To opt out again, send /optout anytime."
  ].join("\n");
}

// Health keywords detection
export function hasHealthKeywords(text = "") {
  if (!text || typeof text !== 'string') return false;
  
  const healthKeywords = [
    'pain', 'sick', 'help', 'emergency', 'urgent', 
    'depression', 'anxiety', 'mental', 'stress',
    'hurt', 'feel', 'doctor', 'medicine', 'treatment'
  ];
  
  const lowerText = text.toLowerCase();
  return healthKeywords.some(keyword => lowerText.includes(keyword));
}

// Professional health response
export function getHealthResponse() {
  return [
    "I understand you may be experiencing health concerns.",
    "",
    "While I can help with appointments and information, I cannot provide medical advice.",
    "",
    "For immediate care:",
    "• Book an appointment: Send 'Your Name, preferred time'",
    "• For emergencies: Please call our 24/7 hotline immediately",
    "",
    "Our medical professionals are here to help."
  ].join("\n");
}

export default {
  getMainMenu,
  getFAQMenu,
  getHelpMenu,
  getBookingInstructions,
  getStaffConnectionMessage,
  getOwnerProfile,
  looksLikeBooking,
  validateBookingFormat,
  getBookingReply,
  getInvalidBookingMessage,
  sanitizeText,
  isAuthorizedMD,
  getErrorMessage,
  getOptOutMessage,
  getOptInMessage,
  hasHealthKeywords,
  getHealthResponse
};