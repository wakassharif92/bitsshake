interface EmailData {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(data: EmailData) {
  try {
    // Send emails via Resend with verified domain
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "hello@bitsoclock.com",
        to: data.to,
        subject: data.subject,
        html: data.html,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Email sending error:", responseData);
      throw new Error(responseData.message || "Email service failed");
    }

    console.log("Email sent successfully:", responseData);
    return { success: true, data: responseData };
  } catch (err: any) {
    console.error("Email sending error:", err);
    return { success: false, error: err.message };
  }
}

export function generateSigningLink(documentId: string, email: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/sign/${documentId}?email=${encodeURIComponent(email)}`;
}

export function createSigningEmailTemplate(
  recipientName: string,
  documentTitle: string,
  signingLink: string,
) {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>BitsShake - Document Signing Required</h2>
          
          <p>Hi ${recipientName},</p>
          
          <p>A document awaiting your signature has been sent to you:</p>
          
          <p style="font-size: 16px; font-weight: bold; background-color: #f5f5f5; padding: 10px; border-left: 4px solid #0066cc;">
            ${documentTitle}
          </p>
          
          <p>Please click the button below to review and sign the document:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signingLink}" style="display: inline-block; padding: 12px 30px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Sign Document
            </a>
          </div>
          
          <p style="font-size: 12px; color: #666;">
            If the button doesn't work, copy and paste this link in your browser:<br/>
            <code>${signingLink}</code>
          </p>
          
          <p style="margin-top: 30px; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 15px;">
            This is an automated message from BitsShake. Please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `;
}
