import { Resend } from "resend";
import { env } from "../env";
import { logger } from "./logger";

const resend = new Resend(env.RESEND_API_KEY);

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(data: EmailData): Promise<boolean> {
  // In development, just log the email instead of sending it if no API key
  if (env.NODE_ENV === "development" && !env.RESEND_API_KEY) {
    logger.info({
      email: {
        to: data.to,
        subject: data.subject,
        htmlLength: data.html.length,
        textLength: data.text?.length || 0,
      }
    }, "Email would be sent (development mode - no API key)");
    
    console.log("📧 EMAIL PREVIEW:");
    console.log(`To: ${data.to}`);
    console.log(`Subject: ${data.subject}`);
    console.log("HTML Content:");
    console.log(data.html);
    console.log("---");
    
    return true;
  }

  // Send email using Resend
  try {
    logger.info({ to: data.to, subject: data.subject }, "Sending email via Resend");
    
    const response = await resend.emails.send({
      from: env.FROM_EMAIL,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    });

    if (response.error) {
      logger.error({ 
        error: response.error, 
        to: data.to, 
        subject: data.subject 
      }, "Resend API error");
      return false;
    }
    
    logger.info({ 
      emailId: response.data?.id,
      to: data.to 
    }, "Email sent successfully via Resend");
    return true;
    
  } catch (error) {
    logger.error({ error, to: data.to, subject: data.subject }, "Failed to send email via Resend");
    return false;
  }
}

export function generateQuizEmailTemplate(params: {
  recipientName?: string;
  senderName?: string;
  subject: string;
  message?: string;
  quizTitle: string;
  quizLink: string;
  validityHours: number;
  timePerQuestion: number;
}): { html: string; text: string } {
  const {
    recipientName,
    senderName,
    subject,
    message,
    quizTitle,
    quizLink,
    validityHours,
    timePerQuestion,
  } = params;

  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset styles */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    /* Main styles */
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      padding: 30px 20px;
      text-align: center;
    }
    
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    
    .content {
      padding: 30px 20px;
    }
    
    .quiz-info {
      background-color: #f8f9ff;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
    }
    
    .quiz-info h3 {
      margin: 0 0 15px 0;
      font-size: 18px;
      font-weight: 600;
      color: #333333;
    }
    
    .quiz-info p {
      margin: 8px 0;
      color: #555555;
    }
    
    .cta-button {
      display: inline-block;
      background-color: #667eea;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    
    .cta-button:hover {
      background-color: #5a67d8;
    }
    
    .footer {
      background-color: #f8f8f8;
      padding: 20px;
      text-align: center;
      font-size: 14px;
      color: #666666;
      border-top: 1px solid #eeeeee;
    }
    
    .expiry-warning {
      color: #e53e3e;
      font-weight: 600;
    }
    
    .link-fallback {
      font-size: 12px;
      color: #888888;
      margin-top: 15px;
      word-break: break-all;
    }
    
    .reminder {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      padding: 12px;
      margin: 20px 0;
      color: #856404;
    }
    
    /* Responsive */
    @media only screen and (max-width: 480px) {
      .container { margin: 10px; }
      .content { padding: 20px 15px; }
      .cta-button { padding: 12px 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📝 You've Been Invited to Take a Quiz!</h1>
    </div>
    
    <div class="content">
      ${recipientName ? `<p>Hi ${recipientName},</p>` : '<p>Hello!</p>'}
      
      ${senderName ? `<p>${senderName} has invited you to take a quiz.</p>` : '<p>You have been invited to take a quiz.</p>'}
      
      ${message ? `<p>${message}</p>` : ''}
      
      <div class="quiz-info">
        <h3>📋 Quiz Details</h3>
        <p><strong>Title:</strong> ${quizTitle}</p>
        <p><strong>Time per question:</strong> ${timePerQuestion} seconds</p>
        <p><strong>Link expires:</strong> <span class="expiry-warning">in ${validityHours} hours</span></p>
      </div>
      
      <p>Click the button below to start the quiz:</p>
      
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
        <tr>
          <td>
            <a href="${quizLink}" class="cta-button" target="_blank" rel="noopener">Start Quiz →</a>
          </td>
        </tr>
      </table>
      
      <div class="link-fallback">
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <a href="${quizLink}" target="_blank" rel="noopener">${quizLink}</a>
      </div>
      
      <div class="reminder">
        <p><strong>⏰ Important:</strong> This link will expire in ${validityHours} hours, so don't wait too long!</p>
      </div>
    </div>
    
    <div class="footer">
      <p>This quiz was generated by Quiz.it</p>
      <p style="margin: 5px 0; color: #999;">Create engaging quizzes from your documents</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
You've Been Invited to Take a Quiz!

${recipientName ? `Hi ${recipientName},` : 'Hello!'}

${senderName ? `${senderName} has invited you to take a quiz.` : ''}

${message || ''}

Quiz Details:
- Title: ${quizTitle}
- Time per question: ${timePerQuestion} seconds
- Link expires in: ${validityHours} hours

Click this link to start the quiz:
${quizLink}

⏰ Remember: This link will expire in ${validityHours} hours, so don't wait too long!

---
This quiz was generated by Quiz.it
`;

  return { html, text };
}
