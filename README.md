# SerenityCareAI Telegram Bot

**Professional Telegram customer support bot for Serenity Royale Hospital, Abuja**

A production-ready Telegram bot that handles patient inquiries, appointment bookings, media analysis (images, voice, video, documents), and provides medical information while maintaining NDPR compliance.

## 🚀 Features

### Core Functionality
- **Smart Menu System**: Interactive appointment booking, FAQ access, staff connection
- **Media Processing**: AI-powered analysis of images, voice messages, videos, and documents
- **Appointment Booking**: Natural language booking ("John Doe, Friday 3pm")
- **Emergency Detection**: Automatic identification of urgent health concerns
- **Owner Recognition**: Professional responses about clinic management

### Admin Features (MD-Only)
- `/md_brief`: Daily analytics (chats, bookings, cancellations, FAQs)
- `/md_followups`: Pending/rescheduled appointments list
- API endpoints for analytics and reporting

### Compliance & Security
- **NDPR Compliant**: Opt-out/opt-in functionality (`/optout`, `/optin`)
- **Data Logging**: Comprehensive chat and appointment tracking
- **Access Control**: Role-based permissions for administrative functions
- **Secure Storage**: Supabase integration with Row Level Security (RLS)

### AI Integration
- **Gemini AI**: Professional text responses and media analysis
- **Voice Transcription**: Audio message to text conversion
- **Image Analysis**: Medical-friendly image descriptions
- **Document Summarization**: PDF and document content extraction

## 📋 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Supabase account and project
- Google AI Studio API key (Gemini)

### 1. Clone and Install
```bash
git clone <repository-url>
cd SerenityCareAI-Telegram
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and configure:

```env
# Required for basic functionality
TELEGRAM_BOT_TOKEN=your_bot_token_here
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key

# Clinic configuration
OWNER_NAME=Dr. Kunle Adesina
CLINIC_NAME=Serenity Royale Hospital
CITY=Abuja

# Admin access (get user ID with /whoami command)
MD_TELEGRAM_USER_ID=your_telegram_user_id

# Production settings (leave blank for development)
APP_BASE_URL=
PORT=7860
```

### 3. Database Setup
1. Create a new Supabase project
2. Run the SQL script from `supabase/schema.sql` in your Supabase SQL Editor
3. Verify tables and policies are created

### 4. Local Development
```bash
# Start in polling mode (for development)
npm run dev
```

Test the bot by:
1. Finding your bot on Telegram (using the bot username from BotFather)
2. Sending `/start` to see the main menu
3. Testing appointment booking: "John Doe, Friday 3pm"
4. Testing media uploads (images, voice messages, PDFs)

## 🌐 Production Deployment

### Vercel Deployment

1. **Create `vercel.json`** (included in project):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/telegram/webhook",
      "dest": "/api/server.js"
    },
    {
      "src": "/api/(.*)",
      "dest": "/api/server.js"
    }
  ]
}
```

2. **Deploy to Vercel**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Include APP_BASE_URL=https://your-app.vercel.app
```

3. **Configure Webhook**:
```bash
# After deployment, set the webhook URL
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://your-app.vercel.app/api/telegram/webhook"
```

### Environment Variables for Production
Set these in your Vercel dashboard:

```env
NODE_ENV=production
APP_BASE_URL=https://your-app.vercel.app
TELEGRAM_BOT_TOKEN=your_token
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
GEMINI_API_KEY=your_key
MD_TELEGRAM_USER_ID=your_user_id
OWNER_NAME=Dr. Kunle Adesina
CLINIC_NAME=Serenity Royale Hospital
CITY=Abuja
```

## 📚 API Documentation

### Health Check
```
GET /api/health
```
Returns server status and service availability.

### Admin Endpoints (MD-Only)

#### Daily Brief
```
GET /api/md/brief
```
Returns daily statistics: chats, bookings, cancellations, FAQs.

#### Follow-ups
```
GET /api/md/followups
```
Returns pending/rescheduled appointments (limit 20).

#### Appointments Due Today
```
GET /api/appointments/due-today
```
Returns today's scheduled appointments.

## 🧪 Testing

### Manual Testing Checklist

**Basic Functionality:**
- [ ] `/start` shows main menu
- [ ] "1" shows booking instructions
- [ ] "2" shows FAQ menu
- [ ] "3" shows staff connection message
- [ ] Booking format "Name, Time" creates appointment
- [ ] Invalid booking format shows error message

**Media Testing:**
- [ ] Upload image → receives AI description
- [ ] Send voice message → receives transcription
- [ ] Upload PDF → receives document summary
- [ ] Send video → receives video summary

**Admin Commands (requires MD_TELEGRAM_USER_ID):**
- [ ] `/whoami` returns user ID
- [ ] `/md_brief` shows daily statistics
- [ ] `/md_followups` shows appointment list

**NDPR Compliance:**
- [ ] `/optout` stops data logging
- [ ] `/optin` resumes data logging

### API Testing with Postman

Import the collection from `docs/postman_collection.json` and test:

1. **Health Check**: Verify server is running
2. **MD Brief**: Check daily statistics (may return 403 if unauthorized)
3. **Appointments**: Check due today appointments

## 🔧 Configuration

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from @BotFather |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key for full access |
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `MD_TELEGRAM_USER_ID` | ❌ | Telegram user ID for admin access |
| `APP_BASE_URL` | ❌ | Production webhook URL |
| `NODE_ENV` | ❌ | Environment (development/production) |
| `PORT` | ❌ | Server port (default: 7860) |
| `OWNER_NAME` | ❌ | Clinic owner name |
| `CLINIC_NAME` | ❌ | Clinic name |
| `CITY` | ❌ | Clinic city |

### Getting Your Telegram User ID
1. Start the bot
2. Send `/whoami` command
3. Copy the User ID number
4. Add it to `MD_TELEGRAM_USER_ID` in your environment variables

## 🗄️ Database Schema

The bot uses Supabase with the following tables:
- **`patients`**: User profiles and consent tracking
- **`appointments`**: Booking requests and scheduling
- **`chat_logs`**: Message history and analytics
- **`kb_faq`**: Knowledge base for common questions
- **`message_templates`**: Reusable message templates

Run `supabase/schema.sql` to set up the complete database structure with indexes and RLS policies.

## 🚨 Troubleshooting

### Common Issues

**Bot not responding:**
- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify bot is not stopped or deleted in @BotFather
- Check console for error messages

**Database errors:**
- Verify Supabase credentials
- Ensure `schema.sql` has been executed
- Check RLS policies are enabled

**Media analysis not working:**
- Verify `GEMINI_API_KEY` is valid
- Check Google AI Studio quota
- Review file size limits (10MB max)

**Webhook issues:**
- Verify `APP_BASE_URL` is set correctly
- Check webhook is set with Telegram API
- Ensure HTTPS is used for webhook URL

### Debug Mode

Set `NODE_ENV=development` for detailed logging and error messages.

### Logs

Monitor console output for:
- Service initialization messages
- Error logs with stack traces
- Request/response logs
- Database operation results

## 📝 License

Private project for Serenity Royale Hospital. All rights reserved.

## 🤝 Support

For technical support or feature requests, contact the development team.

---

**Built with:**
- [Telegraf.js](https://telegraf.js.org/) - Telegram Bot Framework
- [Supabase](https://supabase.com/) - Database and Authentication
- [Google Gemini AI](https://ai.google.dev/) - AI Text and Media Analysis
- [Express.js](https://expressjs.com/) - Web Server
- [Vercel](https://vercel.com/) - Deployment Platform