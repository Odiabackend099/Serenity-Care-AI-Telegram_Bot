import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';

/**
 * Gemini AI Integration
 * Handles text generation and media analysis (transcription, summarization)
 */

let genAI = null;
let textModel = null;
let visionModel = null;

// Initialize Gemini AI
export function initializeGemini() {
  if (!env.GEMINI_API_KEY) {
    console.warn('⚠️  Gemini API key not configured - using mock responses');
    return null;
  }
  
  try {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    console.log('✅ Gemini AI initialized');
    return genAI;
  } catch (error) {
    console.error('Error initializing Gemini:', error);
    return null;
  }
}

// Get AI client (lazy initialization)
function getGeminiClient() {
  if (!genAI) {
    genAI = initializeGemini();
  }
  return genAI;
}

/**
 * System prompts for different use cases
 */
const SYSTEM_PROMPTS = {
  general: `You are SerenityBot, a professional AI assistant for ${env.CLINIC_NAME} in ${env.CITY}. 

GUIDELINES:
- Respond professionally and empathetically
- Keep responses under 80 words
- Never provide medical diagnosis or specific treatment advice
- Direct urgent medical concerns to immediate professional care
- Focus on scheduling appointments and providing general information
- Use warm, supportive tone while maintaining boundaries

SERVICES:
- Mental health support and counseling
- Substance-use counseling  
- General medical consultations
- Located in Galadinmawa and Karu, Abuja
- Hours: 8am-6pm Monday-Saturday

Remember: You assist with appointments and information only, not medical advice.`,

  audio_transcription: `You are a medical transcription assistant. Your task is to:

1. Transcribe the audio content clearly and accurately
2. Use proper medical terminology when appropriate
3. Maintain patient confidentiality and professionalism
4. Format the transcription clearly
5. If unclear audio, note "[unclear]" in brackets

Provide ONLY the transcription in clear English. Keep it concise but complete.`,

  image_analysis: `You are a medical image review assistant. Your task is to:

1. Describe what you see in the image objectively
2. Use neutral, non-diagnostic language
3. Keep description under 50 words
4. Focus on visible elements only
5. Never provide diagnosis or medical interpretation

Provide a brief, professional description of the image content.`,

  document_summary: `You are a medical document review assistant. Your task is to:

1. Summarize the key points of the document
2. Identify document type (lab report, prescription, etc.)
3. Use 2-3 bullet points maximum
4. Maintain professional medical language
5. Never interpret results or provide medical advice

Provide a brief summary of the document's content and type.`,

  video_summary: `You are a medical video review assistant. Your task is to:

1. Summarize the video content in 2-3 sentences
2. Identify the general subject matter
3. Use professional, neutral language
4. Focus on observable content only
5. Never provide medical interpretation

Provide a high-level summary of the video content.`
};

/**
 * Text Generation
 */

// Generate text reply for general queries
export async function llmTextReply(userText) {
  const client = getGeminiClient();
  if (!client || !textModel) {
    return "I'm currently unable to process your request. Please contact our staff directly for assistance.";
  }
  
  try {
    const prompt = `${SYSTEM_PROMPTS.general}\n\nUser message: "${userText}"\n\nResponse:`;
    
    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Ensure response is within bounds and professional
    if (text.length > 400) {
      text = text.substring(0, 397) + "...";
    }
    
    return text || "Thank you for your message. A staff member will assist you shortly.";
    
  } catch (error) {
    console.error('Error in llmTextReply:', error);
    return "I'm having trouble processing your request right now. Please try again or contact our staff directly.";
  }
}

/**
 * Media Analysis
 */

// Analyze media (images, audio, video, documents)
export async function llmAnalyzeMedia({ bufferBase64, contentType, filename = '' }) {
  const client = getGeminiClient();
  if (!client || !visionModel) {
    return "Media analysis is currently unavailable. Please contact our staff for manual review.";
  }
  
  try {
    let prompt = '';
    let mediaType = 'unknown';
    
    // Determine media type and appropriate prompt
    if (contentType.startsWith('image/')) {
      prompt = SYSTEM_PROMPTS.image_analysis;
      mediaType = 'image';
    } else if (contentType.startsWith('audio/')) {
      prompt = SYSTEM_PROMPTS.audio_transcription;
      mediaType = 'audio';
    } else if (contentType.startsWith('video/')) {
      prompt = SYSTEM_PROMPTS.video_summary;
      mediaType = 'video';
    } else if (contentType === 'application/pdf' || contentType.includes('document')) {
      prompt = SYSTEM_PROMPTS.document_summary;
      mediaType = 'document';
    } else {
      return `File received: ${filename || 'Unknown file'}. Our staff will review this file type manually.`;
    }
    
    // Prepare media data for Gemini
    const mediaPart = {
      inlineData: {
        data: bufferBase64,
        mimeType: contentType
      }
    };
    
    const result = await visionModel.generateContent([prompt, mediaPart]);
    const response = await result.response;
    let text = response.text();
    
    // Format response based on media type
    let formattedResponse = '';
    switch (mediaType) {
      case 'image':
        formattedResponse = `📸 **Image Analysis:**\n${text}`;
        break;
      case 'audio':
        formattedResponse = `🎵 **Audio Transcription:**\n${text}`;
        break;
      case 'video':
        formattedResponse = `🎥 **Video Summary:**\n${text}`;
        break;
      case 'document':
        formattedResponse = `📄 **Document Summary:**\n${text}`;
        break;
      default:
        formattedResponse = text;
    }
    
    // Add professional disclaimer
    formattedResponse += "\n\n*Note: This is an AI analysis. For medical concerns, please consult with our healthcare professionals.*";
    
    return formattedResponse;
    
  } catch (error) {
    console.error('Error in llmAnalyzeMedia:', error);
    
    // Determine basic media type for fallback message
    if (contentType.startsWith('image/')) {
      return "📸 Image received. Our medical staff will review it during your appointment.";
    } else if (contentType.startsWith('audio/')) {
      return "🎵 Audio message received. Our staff will listen to it and respond accordingly.";
    } else if (contentType.startsWith('video/')) {
      return "🎥 Video received. Our team will review it as part of your consultation.";
    } else if (contentType === 'application/pdf') {
      return "📄 Document received. Our staff will review it and discuss during your appointment.";
    } else {
      return `File received (${filename || 'unknown type'}). Our team will review it manually.`;
    }
  }
}

/**
 * Specialized Analysis Functions
 */

// Transcribe audio to text
export async function transcribeAudio(bufferBase64, contentType) {
  return await llmAnalyzeMedia({ 
    bufferBase64, 
    contentType, 
    filename: 'audio_message' 
  });
}

// Analyze image content
export async function analyzeImage(bufferBase64, contentType) {
  return await llmAnalyzeMedia({ 
    bufferBase64, 
    contentType, 
    filename: 'image_file' 
  });
}

// Summarize document
export async function summarizeDocument(bufferBase64, contentType, filename = '') {
  return await llmAnalyzeMedia({ 
    bufferBase64, 
    contentType, 
    filename 
  });
}

// Summarize video
export async function summarizeVideo(bufferBase64, contentType) {
  return await llmAnalyzeMedia({ 
    bufferBase64, 
    contentType, 
    filename: 'video_file' 
  });
}

/**
 * Health and Safety Checks
 */

// Check for emergency keywords in text
export function containsEmergencyKeywords(text) {
  const emergencyKeywords = [
    'emergency', 'urgent', 'help', 'dying', 'suicide', 'kill myself',
    'overdose', 'chest pain', 'can\'t breathe', 'bleeding', 'unconscious'
  ];
  
  const lowerText = text.toLowerCase();
  return emergencyKeywords.some(keyword => lowerText.includes(keyword));
}

// Generate emergency response
export function getEmergencyResponse() {
  return [
    "🚨 **URGENT MEDICAL ATTENTION NEEDED**",
    "",
    "If this is a medical emergency:",
    "• Call emergency services immediately: 199 or 112",
    "• Go to the nearest hospital emergency room",
    "",
    "For mental health crisis:",
    "• National Mental Health Helpline: 080-963-4357",
    "",
    `Our clinic (${env.CLINIC_NAME}) is available 8am-6pm for urgent appointments.`
  ].join("\n");
}

export default {
  initializeGemini,
  llmTextReply,
  llmAnalyzeMedia,
  transcribeAudio,
  analyzeImage,
  summarizeDocument,
  summarizeVideo,
  containsEmergencyKeywords,
  getEmergencyResponse
};