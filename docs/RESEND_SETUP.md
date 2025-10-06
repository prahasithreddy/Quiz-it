# Resend Email Integration Setup

## Overview
Your quiz application now uses **Resend** for sending quiz invitation emails. Resend is a modern email API service designed for developers with excellent deliverability and easy integration.

## Setup Instructions

### 1. Get Your Resend API Key
1. Sign up at [resend.com](https://resend.com)
2. Go to your dashboard and create an API key
3. Copy your API key (starts with `re_`)

### 2. Domain Configuration (Recommended for Production)
For better email deliverability in production:

1. **Add your domain** in the Resend dashboard
2. **Verify your domain** by adding the provided DNS records
3. **Update FROM_EMAIL** to use your verified domain (e.g., `noreply@yourdomain.com`)

### 3. Environment Variables
Add these variables to your `.env.local` file:

```bash
# Required for OpenAI quiz generation
OPENAI_API_KEY=your_openai_api_key_here

# Resend email configuration
RESEND_API_KEY=re_your_resend_api_key_here
FROM_EMAIL=noreply@yourdomain.com

# Optional - for production deployment
BASE_URL=https://yourdomain.com
NODE_ENV=production
```

### 4. Development vs Production Behavior

**Development Mode (no RESEND_API_KEY):**
- Emails are logged to console for preview
- No actual emails are sent
- Perfect for testing the quiz flow

**Production Mode (with RESEND_API_KEY):**
- Emails are sent via Resend API
- Professional email templates with proper styling
- Full deliverability and tracking

## Email Template Features

✅ **Professional Design** - Modern, responsive email template  
✅ **Cross-Client Compatibility** - Works in Gmail, Outlook, Apple Mail, etc.  
✅ **Mobile Responsive** - Optimized for mobile devices  
✅ **Clear Call-to-Action** - Prominent "Start Quiz" button  
✅ **Accessibility** - Proper ARIA labels and fallback text  
✅ **Link Fallback** - Text link if button doesn't work  

## Testing Your Integration

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Generate a quiz** from a document

3. **Click "Send Quiz via Email"** in the results

4. **Fill out the form** with a test email

5. **Check behavior:**
   - Without API key: Email preview in console
   - With API key: Actual email sent via Resend

## Email Content Preview

The email includes:
- Personalized greeting (if recipient name provided)
- Sender identification (if sender name provided)
- Custom message (optional)
- Quiz details (title, timing, expiry)
- Prominent "Start Quiz" button
- Link expiry warnings
- Professional branding

## API Endpoints Used

- `POST /api/quiz/share` - Creates quiz session and sends email
- `GET /api/quiz/session/[sessionId]` - Validates quiz access
- `POST /api/quiz/session/[sessionId]` - Handles quiz interactions

## Rate Limiting

- **Quiz sharing:** 5 requests per 5 minutes per IP
- **Quiz taking:** 30 requests per minute per IP
- **Quiz generation:** 10 requests per minute per IP

## Production Considerations

1. **Domain Verification:** Set up SPF, DKIM, and DMARC records
2. **Monitoring:** Monitor email deliverability in Resend dashboard
3. **Error Handling:** Emails that fail to send are logged with details
4. **Session Storage:** Consider replacing in-memory store with database
5. **Cleanup:** Expired sessions are automatically cleaned up

## Support

For Resend-specific issues:
- [Resend Documentation](https://resend.com/docs)
- [Resend Support](https://resend.com/support)

For application issues, check the server logs for detailed error messages.

