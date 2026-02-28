import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

interface UpdateInvoiceMilestoneSignatureRequest {
  invoiceId: string;
  actorEmail: string;
  milestoneIndex: number;
  role: "sender" | "receiver";
  signatureText: string;
  signatureStyle?: string;
  ip?: string;
  city?: string;
  country?: string;
}

interface UpdateInvoiceMilestoneSignatureResponse {
  success: boolean;
  message?: string;
  status?:
    | "in_progress"
    | "draft"
    | "sent"
    | "received"
    | "completed"
    | "paid"
    | "overdue";
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateInvoiceMilestoneSignatureResponse>,
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      invoiceId,
      actorEmail,
      milestoneIndex,
      role,
      signatureText,
      signatureStyle,
      ip,
      city,
      country,
    } =
      req.body as UpdateInvoiceMilestoneSignatureRequest;

    if (
      !invoiceId ||
      !actorEmail ||
      !role ||
      (!Number.isInteger(milestoneIndex) && milestoneIndex !== 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing invoiceId, actorEmail, milestoneIndex, or role",
      });
    }

    const normalizedActorEmail = actorEmail.trim().toLowerCase();
    const normalizedSignature = (signatureText || "").trim();
    const normalizedStyle =
      signatureStyle === "script" || signatureStyle === "normal"
        ? signatureStyle
        : "cursive";
    const forwardedFor = req.headers["x-forwarded-for"];
    const headerIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : (forwardedFor || "").split(",")[0]?.trim();
    const savedIp = (ip || headerIp || "Unknown").toString();
    const savedCity = (city || "Unknown").toString();
    const savedCountry = (country || "Unknown").toString();
    const signedAt = new Date().toISOString();

    if (!normalizedSignature) {
      return res.status(400).json({
        success: false,
        error: "Signature text is required",
      });
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return res
        .status(404)
        .json({ success: false, error: "Invoice not found" });
    }

    const senderEmail = (invoice.sender_signer_email || "")
      .toString()
      .trim()
      .toLowerCase();
    const receiverEmail = (invoice.receiver_signer_email || "")
      .toString()
      .trim()
      .toLowerCase();

    const isAuthorized =
      (role === "sender" && normalizedActorEmail === senderEmail) ||
      (role === "receiver" && normalizedActorEmail === receiverEmail);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error:
          role === "sender"
            ? "Only sender can sign sender signature"
            : "Only receiver can sign receiver signature",
      });
    }

    const milestones = Array.isArray(invoice.milestones)
      ? [...invoice.milestones]
      : [];

    if (milestoneIndex < 0 || milestoneIndex >= milestones.length) {
      return res.status(400).json({
        success: false,
        error: "Invalid milestone index",
      });
    }

    if (milestoneIndex > 0) {
      const previousMilestonesFullySigned = milestones
        .slice(0, milestoneIndex)
        .every(
          (m: Record<string, unknown>) =>
            !!(m.sender_signature_text || "").toString().trim() &&
            !!(m.receiver_signature_text || "").toString().trim(),
        );

      if (!previousMilestonesFullySigned) {
        return res.status(400).json({
          success: false,
          error:
            "Previous milestone must be signed by both sender and receiver first",
        });
      }
    }

    const existingMilestone = milestones[milestoneIndex] || {};
    milestones[milestoneIndex] = {
      ...existingMilestone,
      ...(role === "sender"
        ? {
            sender_signature_text: normalizedSignature,
            sender_signature_style: normalizedStyle,
            sender_signed_by_ip: savedIp,
            sender_signed_by_city: savedCity,
            sender_signed_by_country: savedCountry,
            sender_signed_at: signedAt,
          }
        : {
            receiver_signature_text: normalizedSignature,
            receiver_signature_style: normalizedStyle,
            receiver_signed_by_ip: savedIp,
            receiver_signed_by_city: savedCity,
            receiver_signed_by_country: savedCountry,
            receiver_signed_at: signedAt,
          }),
    };

    const allMilestonesFullySigned =
      milestones.length > 0 &&
      milestones.every(
        (m: Record<string, unknown>) =>
          !!(m.sender_signature_text || "").toString().trim() &&
          !!(m.receiver_signature_text || "").toString().trim(),
      );

    const nextStatus = allMilestonesFullySigned
      ? "completed"
      : role === "sender"
        ? "sent"
        : "received";

    const { error: updateError } = await supabaseAdmin
      .from("invoices")
      .update({
        milestones,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: updateError.message || "Failed to save signature",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Signature saved successfully",
      status: nextStatus,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ success: false, error: message });
  }
}
