import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Supabase Database Integration
 * Handles patient management, chat logging, appointments, and analytics
 */

// Initialize Supabase client
let supabase = null;

export function initializeSupabase() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  Supabase not configured - using mock mode');
    return null;
  }
  
  supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('✅ Supabase client initialized');
  return supabase;
}

// Get Supabase client (lazy initialization)
export function getSupabaseClient() {
  if (!supabase) {
    supabase = initializeSupabase();
  }
  return supabase;
}

/**
 * Patient Management
 */

// Upsert patient by Telegram ID
export async function upsertPatientByTelegramId(telegramId, userData = {}) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const patientData = {
      telegram_user_id: telegramId,
      external_id: `telegram:${telegramId}`,
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      username: userData.username || '',
      phone_number: userData.phone_number || '',
      consent_opt_in: true,
      channel: 'telegram',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await client
      .from('patients')
      .upsert(patientData, { 
        onConflict: 'external_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error upserting patient:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in upsertPatientByTelegramId:', error);
    return null;
  }
}

// Get patient by Telegram ID
export async function getPatientByTelegramId(telegramId) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('patients')
      .select('*')
      .eq('telegram_user_id', telegramId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error fetching patient:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getPatientByTelegramId:', error);
    return null;
  }
}

// Update patient consent
export async function updatePatientConsent(telegramId, consentOptIn) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('patients')
      .update({ 
        consent_opt_in: consentOptIn,
        updated_at: new Date().toISOString()
      })
      .eq('telegram_user_id', telegramId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating patient consent:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in updatePatientConsent:', error);
    return null;
  }
}

/**
 * Chat Logging
 */

// Log chat message
export async function logChat(chatData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const logEntry = {
      patient_id: chatData.patient_id,
      telegram_user_id: chatData.telegram_user_id,
      telegram_chat_id: chatData.telegram_chat_id,
      message_type: chatData.message_type || 'text',
      message_text: chatData.message_text || '',
      media_type: chatData.media_type || null,
      media_file_id: chatData.media_file_id || null,
      channel: 'telegram',
      timestamp: new Date().toISOString(),
      metadata: chatData.metadata || {}
    };
    
    const { data, error } = await client
      .from('chat_logs')
      .insert(logEntry)
      .select()
      .single();
    
    if (error) {
      console.error('Error logging chat:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in logChat:', error);
    return null;
  }
}

/**
 * Appointments Management
 */

// Create appointment
export async function createAppointment(appointmentData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const appointment = {
      patient_id: appointmentData.patient_id,
      full_name: appointmentData.full_name,
      preferred_datetime: appointmentData.preferred_datetime,
      status: 'pending',
      channel: 'telegram',
      telegram_user_id: appointmentData.telegram_user_id,
      telegram_chat_id: appointmentData.telegram_chat_id,
      raw_request: appointmentData.raw_request || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await client
      .from('appointments')
      .insert(appointment)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating appointment:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in createAppointment:', error);
    return null;
  }
}

// Get appointments by status
export async function getAppointmentsByStatus(status, limit = 20) {
  const client = getSupabaseClient();
  if (!client) return [];
  
  try {
    const { data, error } = await client
      .from('appointments')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getAppointmentsByStatus:', error);
    return [];
  }
}

/**
 * Analytics and Reporting
 */

// Get daily brief statistics
export async function getDailyBrief(date = null) {
  const client = getSupabaseClient();
  if (!client) {
    return {
      chats: 0,
      bookings: 0,
      cancels: 0,
      faqs: 0
    };
  }
  
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;
    
    // Get chat count
    const { data: chats, error: chatsError } = await client
      .from('chat_logs')
      .select('id', { count: 'exact' })
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay);
    
    // Get booking count (pending appointments created today)
    const { data: bookings, error: bookingsError } = await client
      .from('appointments')
      .select('id', { count: 'exact' })
      .eq('status', 'pending')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);
    
    // Get cancellation count
    const { data: cancels, error: cancelsError } = await client
      .from('appointments')
      .select('id', { count: 'exact' })
      .eq('status', 'cancelled')
      .gte('updated_at', startOfDay)
      .lte('updated_at', endOfDay);
    
    // FAQ count (approximate based on chat logs with FAQ keywords)
    const { data: faqs, error: faqsError } = await client
      .from('chat_logs')
      .select('id', { count: 'exact' })
      .ilike('message_text', '%faq%')
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay);
    
    if (chatsError || bookingsError || cancelsError || faqsError) {
      console.error('Error in getDailyBrief:', { chatsError, bookingsError, cancelsError, faqsError });
    }
    
    return {
      chats: chats?.length || 0,
      bookings: bookings?.length || 0,
      cancels: cancels?.length || 0,
      faqs: faqs?.length || 0
    };
    
  } catch (error) {
    console.error('Error in getDailyBrief:', error);
    return {
      chats: 0,
      bookings: 0,
      cancels: 0,
      faqs: 0
    };
  }
}

// Get follow-up appointments (pending/rescheduled)
export async function getFollowupAppointments(limit = 20) {
  const client = getSupabaseClient();
  if (!client) return [];
  
  try {
    const { data, error } = await client
      .from('appointments')
      .select('id, full_name, preferred_datetime, status, created_at, raw_request')
      .in('status', ['pending', 'rescheduled'])
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching followup appointments:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getFollowupAppointments:', error);
    return [];
  }
}

/**
 * Knowledge Base (FAQ Management)
 */

// Get FAQ by keyword
export async function getFAQByKeyword(keyword) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('kb_faq')
      .select('*')
      .ilike('keywords', `%${keyword}%`)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching FAQ:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getFAQByKeyword:', error);
    return null;
  }
}

export default {
  initializeSupabase,
  getSupabaseClient,
  upsertPatientByTelegramId,
  getPatientByTelegramId,
  updatePatientConsent,
  logChat,
  createAppointment,
  getAppointmentsByStatus,
  getDailyBrief,
  getFollowupAppointments,
  getFAQByKeyword
};