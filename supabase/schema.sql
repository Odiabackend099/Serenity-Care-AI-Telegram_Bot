-- SerenityCareAI Telegram Bot Database Schema
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Create custom types
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'rescheduled');
CREATE TYPE message_channel AS ENUM ('telegram', 'whatsapp', 'web', 'phone');

-- =====================================================
-- PATIENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE NOT NULL, -- e.g., "telegram:123456789"
    telegram_user_id BIGINT UNIQUE,
    whatsapp_phone TEXT,
    
    -- Personal Information
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    username TEXT DEFAULT '',
    phone_number TEXT DEFAULT '',
    email TEXT DEFAULT '',
    
    -- Consent and Privacy (NDPR Compliance)
    consent_opt_in BOOLEAN DEFAULT true,
    consent_date TIMESTAMPTZ DEFAULT NOW(),
    data_retention_date TIMESTAMPTZ,
    
    -- Metadata
    channel message_channel NOT NULL DEFAULT 'telegram',
    preferred_language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'Africa/Lagos',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for patients
CREATE INDEX IF NOT EXISTS idx_patients_telegram_user_id ON patients(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_patients_external_id ON patients(external_id);
CREATE INDEX IF NOT EXISTS idx_patients_channel ON patients(channel);
CREATE INDEX IF NOT EXISTS idx_patients_consent ON patients(consent_opt_in);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at);

-- =====================================================
-- APPOINTMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    
    -- Appointment Details
    full_name TEXT NOT NULL,
    preferred_datetime TEXT, -- User's text input (e.g., "Friday 3pm")
    scheduled_datetime TIMESTAMPTZ, -- Actual scheduled time (set by staff)
    status appointment_status DEFAULT 'pending',
    
    -- Source Information
    channel message_channel NOT NULL DEFAULT 'telegram',
    telegram_user_id BIGINT,
    telegram_chat_id BIGINT,
    raw_request TEXT, -- Original booking text
    
    -- Staff Notes
    staff_notes TEXT DEFAULT '',
    confirmation_sent BOOLEAN DEFAULT false,
    reminder_sent BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for appointments
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_channel ON appointments(channel);
CREATE INDEX IF NOT EXISTS idx_appointments_telegram_user_id ON appointments(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_datetime ON appointments(scheduled_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at);
CREATE INDEX IF NOT EXISTS idx_appointments_updated_at ON appointments(updated_at);

-- =====================================================
-- CHAT LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    
    -- Message Information
    telegram_user_id BIGINT,
    telegram_chat_id BIGINT,
    telegram_message_id INTEGER,
    
    -- Content
    message_type TEXT DEFAULT 'text', -- text, photo, voice, video, document, etc.
    message_text TEXT DEFAULT '',
    media_type TEXT, -- image, audio, video, document
    media_file_id TEXT, -- Telegram file ID
    
    -- Source
    channel message_channel NOT NULL DEFAULT 'telegram',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat_logs
CREATE INDEX IF NOT EXISTS idx_chat_logs_patient_id ON chat_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_telegram_user_id ON chat_logs(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_channel ON chat_logs(channel);
CREATE INDEX IF NOT EXISTS idx_chat_logs_message_type ON chat_logs(message_type);
CREATE INDEX IF NOT EXISTS idx_chat_logs_timestamp ON chat_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_logs_date ON chat_logs(DATE(timestamp));

-- =====================================================
-- KNOWLEDGE BASE FAQ TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS kb_faq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FAQ Content
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT[], -- Array of keywords for matching
    category TEXT DEFAULT 'general',
    
    -- Configuration
    priority INTEGER DEFAULT 0, -- Higher number = higher priority
    is_active BOOLEAN DEFAULT true,
    
    -- Usage Analytics
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for kb_faq
CREATE INDEX IF NOT EXISTS idx_kb_faq_keywords ON kb_faq USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_kb_faq_category ON kb_faq(category);
CREATE INDEX IF NOT EXISTS idx_kb_faq_priority ON kb_faq(priority DESC);
CREATE INDEX IF NOT EXISTS idx_kb_faq_active ON kb_faq(is_active);

-- =====================================================
-- MESSAGE TEMPLATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template Information
    name TEXT UNIQUE NOT NULL,
    template_text TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    
    -- Variables
    variables TEXT[], -- Array of variable names like ["patient_name", "appointment_time"]
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    
    -- Usage Analytics
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for message_templates
CREATE INDEX IF NOT EXISTS idx_message_templates_name ON message_templates(name);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Patients policies
CREATE POLICY "Service role can manage patients" ON patients
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view their own patient record" ON patients
    FOR SELECT USING (auth.uid()::text = external_id);

-- Appointments policies
CREATE POLICY "Service role can manage appointments" ON appointments
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own appointments" ON appointments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patients 
            WHERE patients.id = appointments.patient_id 
            AND patients.external_id = auth.uid()::text
        )
    );

-- Chat logs policies
CREATE POLICY "Service role can manage chat logs" ON chat_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own chat logs" ON chat_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patients 
            WHERE patients.id = chat_logs.patient_id 
            AND patients.external_id = auth.uid()::text
        )
    );

-- KB FAQ policies (read-only for authenticated users)
CREATE POLICY "Service role can manage FAQ" ON kb_faq
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read active FAQ" ON kb_faq
    FOR SELECT USING (is_active = true);

-- Message templates policies (service role only)
CREATE POLICY "Service role can manage templates" ON message_templates
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_faq_updated_at BEFORE UPDATE ON kb_faq
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA
-- =====================================================

-- Insert sample FAQ entries
INSERT INTO kb_faq (question, answer, keywords, category, priority) VALUES
('What are your opening hours?', 'We are open Monday to Saturday from 8:00 AM to 6:00 PM. We are closed on Sundays and public holidays.', ARRAY['hours', 'open', 'time', 'schedule'], 'general', 10),
('Where are you located?', 'We have two locations in Abuja: Galadinmawa and Karu. Please contact us for specific addresses and directions.', ARRAY['location', 'address', 'where', 'direction'], 'general', 10),
('What services do you provide?', 'We specialize in mental health support, substance-use counseling, and general medical consultations.', ARRAY['services', 'treatment', 'help', 'medical'], 'services', 9),
('How do I book an appointment?', 'You can book an appointment by sending us your full name and preferred date/time. For example: "John Doe, Friday 3pm". We will confirm availability and contact you.', ARRAY['book', 'appointment', 'schedule', 'booking'], 'appointments', 9),
('What payment methods do you accept?', 'We accept cash, bank transfers, and insurance. Please bring your insurance card if applicable.', ARRAY['payment', 'insurance', 'cost', 'money'], 'billing', 8),
('Do you handle emergencies?', 'For medical emergencies, please call emergency services (199 or 112) or go to the nearest hospital. Our clinic provides regular consultations during business hours.', ARRAY['emergency', 'urgent', 'crisis'], 'emergency', 10);

-- Insert sample message templates
INSERT INTO message_templates (name, template_text, category, variables) VALUES
('appointment_confirmation', 'Hello {{patient_name}}! Your appointment has been confirmed for {{appointment_time}} at {{clinic_name}}. Please arrive 15 minutes early. Contact us if you need to reschedule.', 'appointments', ARRAY['patient_name', 'appointment_time', 'clinic_name']),
('appointment_reminder', 'Reminder: You have an appointment tomorrow at {{appointment_time}} with {{clinic_name}}. Please confirm your attendance by replying to this message.', 'appointments', ARRAY['appointment_time', 'clinic_name']),
('welcome_message', 'Welcome to {{clinic_name}}! We are here to support your health and wellness journey. How can we assist you today?', 'general', ARRAY['clinic_name']),
('emergency_response', 'This appears to be an emergency. Please call 199 or 112 immediately, or go to the nearest hospital. {{clinic_name}} is available for regular consultations during business hours.', 'emergency', ARRAY['clinic_name']);

-- =====================================================
-- STORAGE BUCKET POLICIES (if using Supabase Storage)
-- =====================================================

-- Note: Run these in the Supabase dashboard if you plan to use file storage
-- 
-- CREATE BUCKET IF NOT EXISTS incoming-media;
-- 
-- CREATE POLICY "Service role can upload media" ON storage.objects
--     FOR INSERT WITH CHECK (bucket_id = 'incoming-media' AND auth.role() = 'service_role');
-- 
-- CREATE POLICY "Service role can read media" ON storage.objects
--     FOR SELECT USING (bucket_id = 'incoming-media' AND auth.role() = 'service_role');

-- =====================================================
-- USEFUL VIEWS
-- =====================================================

-- View for daily statistics
CREATE OR REPLACE VIEW daily_stats AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as total_chats,
    COUNT(DISTINCT patient_id) as unique_patients,
    COUNT(*) FILTER (WHERE message_type = 'text') as text_messages,
    COUNT(*) FILTER (WHERE media_type IS NOT NULL) as media_messages
FROM chat_logs
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- View for appointment summary
CREATE OR REPLACE VIEW appointment_summary AS
SELECT 
    status,
    COUNT(*) as count,
    DATE(created_at) as date
FROM appointments
GROUP BY status, DATE(created_at)
ORDER BY date DESC, status;

-- Grant select permissions on views
GRANT SELECT ON daily_stats TO authenticated;
GRANT SELECT ON appointment_summary TO authenticated;

-- =====================================================
-- FUNCTIONS FOR ANALYTICS
-- =====================================================

-- Function to get daily brief
CREATE OR REPLACE FUNCTION get_daily_brief(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'date', target_date,
        'chats', (
            SELECT COUNT(*) FROM chat_logs 
            WHERE DATE(timestamp) = target_date
        ),
        'bookings', (
            SELECT COUNT(*) FROM appointments 
            WHERE DATE(created_at) = target_date AND status = 'pending'
        ),
        'cancels', (
            SELECT COUNT(*) FROM appointments 
            WHERE DATE(updated_at) = target_date AND status = 'cancelled'
        ),
        'faqs', (
            SELECT COUNT(*) FROM chat_logs 
            WHERE DATE(timestamp) = target_date 
            AND (message_text ILIKE '%faq%' OR message_text ILIKE '%question%')
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_daily_brief TO authenticated;

COMMENT ON SCHEMA public IS 'SerenityCareAI Telegram Bot Database - Handles patient management, appointments, chat logging, and analytics with NDPR compliance and proper security policies.';