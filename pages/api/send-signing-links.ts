import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailRequest {
  documentId: string;
}

interface SendEmailResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SendEmailResponse>,
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { documentId } = req.body as SendEmailRequest;

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Email service not configured. Add RESEND_API_KEY to .env.local",
      });
    }

    // Get the authenticated user
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    // Always use the verified bitsoclock.com domain for sending emails
    const adminEmail = "hello@bitsoclock.com";

    if (token) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser(token);
        if (!user) {
          return res
            .status(401)
            .json({ success: false, error: "Unauthorized" });
        }
      } catch (err) {
        // If auth fails, return error
        console.log("Could not authenticate user");
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
    }

    // Fetch document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    // Fetch recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from("recipients")
      .select("*")
      .eq("document_id", documentId);

    if (recipientsError || !recipients || recipients.length === 0) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch recipients" });
    }

    // sSend emails to each recipient (both signers and viewers)
    const emailPromises = recipients.map(async (recipient) => {
      const signingLink = `https://www.bitsshake.com/sign/${documentId}?email=${encodeURIComponent(recipient.email)}`;

      let emailSubject: string;
      let emailHtml: string;

      if (recipient.role === "signer") {
        emailSubject = `Sign Document: ${document.title}`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You have a document to sign</h2>
            <p>Hello ${recipient.name},</p>
            <p>You have been requested to sign the document: <strong>${document.title}</strong></p>
            <p style="margin-top: 30px;">
              <a href="${signingLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Click here to sign the document
              </a>
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              Or copy this link: ${signingLink}
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 40px;">
              This link is unique to you and expires after 7 days.
            </p>
          </div>
        `;
      } else {
        // Viewer role
        emailSubject = `Action Required: You have been invited to view a document (${document.title})`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color:#2563eb;">Document Viewing Invitation</h2>
            <p>Hello ${recipient.name},</p>
            <p>You have been invited by <strong>${adminEmail}</strong> to view the document: <strong>${document.title}</strong>.</p>
            <p style="margin-top: 24px;">
              <a href="${signingLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
                View Document
              </a>
            </p>
            <p style="margin-top: 24px; color: #666; font-size: 13px;">
              If the button above does not work, copy and paste this link into your browser:<br />
              <span style="word-break:break-all;">${signingLink}</span>
            </p>
            <hr style="margin:32px 0; border:none; border-top:1px solid #eee;" />
            <p style="color: #999; font-size: 12px;">
              This link is unique to you and expires after 7 days.<br />
              If you did not expect this email, you can safely ignore it.
            </p>
          </div>
        `;
      }

      return resend.emails.send({
        from: adminEmail,
        to: recipient.email,
        subject: emailSubject,
        html: emailHtml,
      });
    });

    const results = await Promise.all(emailPromises);
    const successful = results.filter((r) => r.data?.id && !r.error).length;

    // Log results for debugging
    console.log("Email send results:", results);

    if (successful === 0) {
      return res.status(500).json({
        success: false,
        error: "Failed to send emails. Check server logs.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Document sent successfully to ${successful}/${recipients.length} recipients`,
    });
  } catch (error: any) {
    console.error("Error sending emails:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
