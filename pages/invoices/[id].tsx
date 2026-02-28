import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Invoice } from "@/lib/types";
import Toast, { ToastMessage } from "@/components/Toast";

interface InvoiceItem {
  item: string;
  amount: number;
  sender_signature_text?: string;
  receiver_signature_text?: string;
  sender_signature_style?: string;
  receiver_signature_style?: string;
  sender_signed_by_ip?: string;
  sender_signed_by_city?: string;
  sender_signed_by_country?: string;
  sender_signed_at?: string;
  receiver_signed_by_ip?: string;
  receiver_signed_by_city?: string;
  receiver_signed_by_country?: string;
  receiver_signed_at?: string;
}

interface EditableMilestone {
  id: string;
  item: string;
  amount: string;
  sender_signature_text?: string;
  receiver_signature_text?: string;
  sender_signature_style?: string;
  receiver_signature_style?: string;
  sender_signed_by_ip?: string;
  sender_signed_by_city?: string;
  sender_signed_by_country?: string;
  sender_signed_at?: string;
  receiver_signed_by_ip?: string;
  receiver_signed_by_city?: string;
  receiver_signed_by_country?: string;
  receiver_signed_at?: string;
}

const getInvoiceStatusLabel = (status?: string) => {
  if (!status) return "-";
  if (status === "draft") return "In Progress";
  return status.replace(/_/g, " ");
};

export default function InvoiceViewPage() {
  const router = useRouter();
  const { id, email } = router.query;
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isPublicView, setIsPublicView] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [showShareEmailModal, setShowShareEmailModal] = useState(false);
  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [sendingShareEmail, setSendingShareEmail] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [savingMilestones, setSavingMilestones] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [sharedAccessEmail, setSharedAccessEmail] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [editableMilestones, setEditableMilestones] = useState<
    EditableMilestone[]
  >([]);
  const [signatureModal, setSignatureModal] = useState<{
    milestoneIndex: number;
    role: "sender" | "receiver";
    email: string;
    signatureText: string;
    signatureStyle: string;
    milestoneItem: string;
    signedByIp: string;
    signedByCity: string;
    signedByCountry: string;
    signedAt: string;
  } | null>(null);
  const [signatureInput, setSignatureInput] = useState("");
  const [signatureStyleInput, setSignatureStyleInput] = useState<
    "cursive" | "script" | "normal"
  >("cursive");
  const sharePopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showSharePopover) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        sharePopoverRef.current &&
        !sharePopoverRef.current.contains(target)
      ) {
        setShowSharePopover(false);
      }
    };

    globalThis.document.addEventListener("mousedown", handleClickOutside);
    return () => {
      globalThis.document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSharePopover]);

  useEffect(() => {
    if (!id) return;

    const fetchInvoice = async () => {
      const emailFromLink = typeof email === "string" ? email.trim() : "";

      if (emailFromLink) {
        setIsPublicView(true);
        setSharedAccessEmail(emailFromLink.toLowerCase());
        const response = await fetch(
          `/api/public-invoice?invoiceId=${encodeURIComponent(
            String(id),
          )}&email=${encodeURIComponent(emailFromLink)}`,
        );

        if (!response.ok) {
          setInvoice(null);
          setLoading(false);
          return;
        }

        const data = await response.json();
        setInvoice((data?.invoice || null) as Invoice | null);
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setCurrentUserId(session.user.id);
      setCurrentUserEmail((session.user.email || "").toLowerCase());
      setIsPublicView(false);
      setSharedAccessEmail("");

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .eq("admin_id", session.user.id)
        .single();

      if (error || !data) {
        setInvoice(null);
        setLoading(false);
        return;
      }

      setInvoice(data as Invoice);
      setLoading(false);
    };

    fetchInvoice();
  }, [id, email, router]);

  const shareRecipients = useMemo(() => {
    if (!invoice) return [];
    const list = [
      invoice.sender_signer_email || "",
      invoice.receiver_signer_email || "",
      invoice.client_email || "",
    ]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    return Array.from(new Set(list));
  }, [invoice]);

  const isDocumentOwner =
    !isPublicView &&
    !!currentUserId &&
    !!invoice &&
    currentUserId === invoice.admin_id;

  const items = useMemo(() => {
    if (!invoice?.milestones || !Array.isArray(invoice.milestones)) return [];
    return (invoice.milestones as InvoiceItem[]).map((entry) => ({
      item: entry.item || "",
      amount: Number(entry.amount || 0),
      sender_signature_text: entry.sender_signature_text || "",
      receiver_signature_text: entry.receiver_signature_text || "",
      sender_signature_style: entry.sender_signature_style || "cursive",
      receiver_signature_style: entry.receiver_signature_style || "cursive",
      sender_signed_by_ip: entry.sender_signed_by_ip || "",
      sender_signed_by_city: entry.sender_signed_by_city || "",
      sender_signed_by_country: entry.sender_signed_by_country || "",
      sender_signed_at: entry.sender_signed_at || "",
      receiver_signed_by_ip: entry.receiver_signed_by_ip || "",
      receiver_signed_by_city: entry.receiver_signed_by_city || "",
      receiver_signed_by_country: entry.receiver_signed_by_country || "",
      receiver_signed_at: entry.receiver_signed_at || "",
    }));
  }, [invoice]);

  const totalAmount = useMemo(() => {
    if (invoice?.total_amount !== undefined && invoice.total_amount !== null) {
      return Number(invoice.total_amount);
    }
    return items.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }, [invoice, items]);

  const completedMilestoneAmount = useMemo(() => {
    return editableMilestones.reduce((sum, entry) => {
      const isFullySigned =
        !!(entry.sender_signature_text || "").trim() &&
        !!(entry.receiver_signature_text || "").trim();
      if (!isFullySigned) return sum;
      const amount = Number(entry.amount || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }, [editableMilestones]);

  const remainingAmountToBePaid = useMemo(() => {
    return Math.max(totalAmount - completedMilestoneAmount, 0);
  }, [totalAmount, completedMilestoneAmount]);

  useEffect(() => {
    if (items.length > 0) {
      setEditableMilestones(
        items.map((entry, index) => ({
          id: `${index}-${entry.item}`,
          item: entry.item,
          amount: String(entry.amount),
          sender_signature_text: entry.sender_signature_text || "",
          receiver_signature_text: entry.receiver_signature_text || "",
          sender_signature_style: entry.sender_signature_style || "cursive",
          receiver_signature_style: entry.receiver_signature_style || "cursive",
          sender_signed_by_ip: entry.sender_signed_by_ip || "",
          sender_signed_by_city: entry.sender_signed_by_city || "",
          sender_signed_by_country: entry.sender_signed_by_country || "",
          sender_signed_at: entry.sender_signed_at || "",
          receiver_signed_by_ip: entry.receiver_signed_by_ip || "",
          receiver_signed_by_city: entry.receiver_signed_by_city || "",
          receiver_signed_by_country: entry.receiver_signed_by_country || "",
          receiver_signed_at: entry.receiver_signed_at || "",
        })),
      );
      return;
    }
    setEditableMilestones([{ id: "0", item: "", amount: "" }]);
  }, [items]);

  const senderEmailNormalized = (invoice?.sender_signer_email || "")
    .trim()
    .toLowerCase();
  const receiverEmailNormalized = (invoice?.receiver_signer_email || "")
    .trim()
    .toLowerCase();
  const normalizedActorEmail = (
    isPublicView ? sharedAccessEmail : currentUserEmail
  )
    .trim()
    .toLowerCase();
  const isSenderView =
    !!invoice &&
    !!normalizedActorEmail &&
    normalizedActorEmail === senderEmailNormalized;
  const isReceiverView =
    !!invoice &&
    !!normalizedActorEmail &&
    normalizedActorEmail === receiverEmailNormalized;
  const canEditMilestones = isDocumentOwner || isSenderView;

  const addMilestoneRow = () => {
    if (!canEditMilestones) return;
    if (invoice?.invoice_type === "one_time") return;
    setEditableMilestones((prev) => [
      ...prev,
      { id: `${Date.now()}`, item: "", amount: "" },
    ]);
  };

  const removeMilestoneRow = (id: string) => {
    if (!canEditMilestones) return;
    setEditableMilestones((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length > 0
        ? next
        : [{ id: `${Date.now()}`, item: "", amount: "" }];
    });
  };

  const updateMilestoneRow = (
    id: string,
    field: "item" | "amount",
    value: string,
  ) => {
    if (!canEditMilestones) return;
    setEditableMilestones((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const saveMilestones = async () => {
    if (!invoice?.id) return;
    const actorEmail = isDocumentOwner ? currentUserEmail : sharedAccessEmail;

    if (!actorEmail) {
      setToast({
        id: String(Date.now()),
        message: "Unable to identify editor",
        type: "error",
      });
      return;
    }

    const normalized = editableMilestones
      .map((row) => ({
        item: row.item.trim(),
        amount: Number(row.amount),
        sender_signature_text: row.sender_signature_text || "",
        receiver_signature_text: row.receiver_signature_text || "",
        sender_signature_style: row.sender_signature_style || "cursive",
        receiver_signature_style: row.receiver_signature_style || "cursive",
        sender_signed_by_ip: row.sender_signed_by_ip || "",
        sender_signed_by_city: row.sender_signed_by_city || "",
        sender_signed_by_country: row.sender_signed_by_country || "",
        sender_signed_at: row.sender_signed_at || "",
        receiver_signed_by_ip: row.receiver_signed_by_ip || "",
        receiver_signed_by_city: row.receiver_signed_by_city || "",
        receiver_signed_by_country: row.receiver_signed_by_country || "",
        receiver_signed_at: row.receiver_signed_at || "",
      }))
      .filter((row) => row.item);

    if (normalized.length === 0) {
      setToast({
        id: String(Date.now()),
        message: "Add at least one milestone item",
        type: "error",
      });
      return;
    }

    const invalid = normalized.find(
      (row) => Number.isNaN(row.amount) || row.amount <= 0,
    );
    if (invalid) {
      setToast({
        id: String(Date.now()),
        message: "Each milestone amount must be greater than 0",
        type: "error",
      });
      return;
    }

    setSavingMilestones(true);
    try {
      const response = await fetch("/api/update-invoice-milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          actorEmail,
          milestones: normalized,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to update milestones");
      }

      const updatedTotal = normalized.reduce((sum, row) => sum + row.amount, 0);
      setInvoice((prev) =>
        prev
          ? {
              ...prev,
              milestones: normalized,
              total_amount: updatedTotal,
              amount: updatedTotal,
              status: (data?.status || prev.status) as Invoice["status"],
            }
          : prev,
      );

      setToast({
        id: String(Date.now()),
        message: data.message || "Milestones updated successfully",
        type: "success",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update milestones";
      setToast({
        id: String(Date.now()),
        message,
        type: "error",
      });
    } finally {
      setSavingMilestones(false);
    }
  };

  const handleShareViaEmail = async () => {
    if (!id) return;
    if (shareRecipients.length === 0) {
      setToast({
        id: String(Date.now()),
        message: "No recipient email found on this invoice.",
        type: "error",
      });
      setShowShareEmailModal(false);
      return;
    }

    setShowShareEmailModal(false);
    setSendingShareEmail(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/send-invoice-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ invoiceId: String(id) }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to share invoice");
      }

      setToast({
        id: String(Date.now()),
        message: data.message || "Invoice shared successfully",
        type: "success",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to share invoice";
      setToast({
        id: String(Date.now()),
        message,
        type: "error",
      });
    } finally {
      setSendingShareEmail(false);
    }
  };

  const copyRecipientLink = (recipientEmail: string) => {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const link = `${baseUrl}/invoices/${id}?email=${encodeURIComponent(
      recipientEmail,
    )}`;
    navigator.clipboard.writeText(link);
    setToast({
      id: String(Date.now()),
      message: "Link copied to clipboard!",
      type: "success",
    });
  };

  const loadBrandLogo = async (): Promise<HTMLImageElement | null> => {
    if (typeof window === "undefined") return null;
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = "/bitsshake-logo-5.png";
    });
  };

  const downloadInvoiceAsPDF = async () => {
    if (!invoice) return;
    setDownloadingFile(true);
    try {
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.default;
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 34;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      const logo = await loadBrandLogo();
      const line = (label: string, value?: string | null) =>
        `${label}: ${(value || "-").toString()}`;
      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      pdf.setFillColor(17, 24, 39);
      pdf.roundedRect(margin, y, contentWidth, 78, 10, 10, "F");
      if (logo) {
        const maxLogoW = 124;
        const maxLogoH = 42;
        const ratio = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
        const drawW = Math.max(1, logo.width * ratio);
        const drawH = Math.max(1, logo.height * ratio);
        const logoX = pageWidth - margin - drawW - 16;
        const logoY = y + 10;
        pdf.addImage(
          logo,
          "PNG",
          logoX,
          logoY,
          drawW,
          drawH,
          undefined,
          "FAST",
        );
      }
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.text("INVOICE", margin + 18, y + 30);
      pdf.setFontSize(10);
      pdf.text(invoice.invoice_number || "-", margin + 18, y + 50);
      pdf.text(
        `Status: ${getInvoiceStatusLabel(invoice.status)}`,
        margin + 18,
        y + 66,
      );
      pdf.setFontSize(11);
      pdf.text(
        `Total: ${invoice.currency} ${totalAmount.toFixed(2)}`,
        pageWidth - margin - 160,
        y + 46,
      );
      y += 96;

      ensureSpace(164);
      pdf.setDrawColor(220, 220, 220);
      pdf.roundedRect(margin, y, contentWidth, 152, 8, 8);
      const leftX = margin + 14;
      const rightX = margin + contentWidth / 2 + 8;
      let leftY = y + 20;
      let rightY = y + 20;

      const leftRows = [
        line("Client", invoice.client_name),
        line("Client Email", invoice.client_email),
        line(
          "Type",
          invoice.invoice_type === "one_time"
            ? "One Time Payment"
            : "Milestone",
        ),
        line(
          "Due Date",
          invoice.due_date
            ? new Date(invoice.due_date).toLocaleDateString()
            : "-",
        ),
      ];
      const rightRows = [
        line("Sender", invoice.sender_signer_email),
        line("Receiver", invoice.receiver_signer_email),
        line(
          "Created",
          invoice.created_at
            ? new Date(invoice.created_at).toLocaleString()
            : "-",
        ),
        line(
          "Updated",
          invoice.updated_at
            ? new Date(invoice.updated_at).toLocaleString()
            : "-",
        ),
      ];

      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(10);
      leftRows.forEach((row) => {
        pdf.text(row, leftX, leftY);
        leftY += 26;
      });
      rightRows.forEach((row) => {
        pdf.text(row, rightX, rightY);
        rightY += 26;
      });
      y += 170;

      if (invoice.description) {
        ensureSpace(70);
        pdf.roundedRect(margin, y, contentWidth, 58, 8, 8);
        pdf.setFontSize(9);
        pdf.setTextColor(75, 85, 99);
        pdf.text("Description", margin + 12, y + 18);
        pdf.setTextColor(31, 41, 55);
        pdf.setFontSize(10);
        const desc = pdf.splitTextToSize(
          invoice.description,
          contentWidth - 24,
        );
        pdf.text(desc, margin + 12, y + 36);
        y += 76;
      }

      pdf.setTextColor(17, 24, 39);
      pdf.setFontSize(13);
      pdf.text("Milestones & Signature Details", margin, y);
      y += 14;

      editableMilestones.forEach((entry, index) => {
        ensureSpace(220);
        pdf.setDrawColor(210, 210, 210);
        pdf.roundedRect(margin, y, contentWidth, 206, 8, 8);
        pdf.setFontSize(11);
        pdf.setTextColor(31, 41, 55);
        pdf.text(
          `Milestone ${index + 1}: ${entry.item || "-"}`,
          margin + 12,
          y + 20,
        );
        pdf.text(
          `Amount: ${invoice.currency} ${Number(entry.amount || 0).toFixed(2)}`,
          margin + 12,
          y + 38,
        );

        const colGap = 10;
        const colW = (contentWidth - 24 - colGap) / 2;
        const colY = y + 52;
        const leftColX = margin + 12;
        const rightColX = leftColX + colW + colGap;

        pdf.roundedRect(leftColX, colY, colW, 142, 6, 6);
        pdf.roundedRect(rightColX, colY, colW, 142, 6, 6);

        const drawSigColumn = (
          x: number,
          title: string,
          signature: string | undefined,
          emailValue: string | null | undefined,
          ipValue: string | undefined,
          cityValue: string | undefined,
          countryValue: string | undefined,
          signedAtValue: string | undefined,
        ) => {
          let yy = colY + 16;
          pdf.setFontSize(10);
          pdf.setTextColor(17, 24, 39);
          pdf.text(title, x + 8, yy);
          yy += 16;
          pdf.setFontSize(9);
          pdf.setTextColor(55, 65, 81);
          const rows = [
            line("Signature", signature || "-"),
            line("Email", emailValue || "-"),
            line("IP", ipValue || "-"),
            line("Location", `${cityValue || "-"}, ${countryValue || "-"}`),
            line(
              "Signed At",
              signedAtValue ? new Date(signedAtValue).toLocaleString() : "-",
            ),
          ];
          rows.forEach((row) => {
            const wrapped = pdf.splitTextToSize(row, colW - 16);
            pdf.text(wrapped, x + 8, yy);
            yy += wrapped.length * 12 + 2;
          });
        };

        drawSigColumn(
          leftColX,
          "Sender Signature",
          entry.sender_signature_text,
          invoice.sender_signer_email,
          entry.sender_signed_by_ip,
          entry.sender_signed_by_city,
          entry.sender_signed_by_country,
          entry.sender_signed_at,
        );
        drawSigColumn(
          rightColX,
          "Receiver Signature",
          entry.receiver_signature_text,
          invoice.receiver_signer_email,
          entry.receiver_signed_by_ip,
          entry.receiver_signed_by_city,
          entry.receiver_signed_by_country,
          entry.receiver_signed_at,
        );

        y += 220;
      });

      ensureSpace(22);
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text("Generated by BitsShake", margin, y + 14);

      const filename = `${(invoice.invoice_number || "invoice").replace(/\s+/g, "_")}.pdf`;
      pdf.save(filename);
      setShowDownloadModal(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to download PDF";
      setToast({
        id: String(Date.now()),
        message,
        type: "error",
      });
    } finally {
      setDownloadingFile(false);
    }
  };

  const downloadInvoiceAsPNG = async () => {
    if (!invoice) return;
    setDownloadingFile(true);
    try {
      const canvas = globalThis.document.createElement("canvas");
      const width = 1400;
      const padding = 48;
      const height = Math.max(1200, 500 + editableMilestones.length * 330);
      const logo = await loadBrandLogo();

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      const line = (label: string, value?: string | null) =>
        `${label}: ${(value || "-").toString()}`;
      let y = padding;

      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.roundRect(padding, y, width - padding * 2, 120, 20);
      ctx.fill();
      if (logo) {
        const maxLogoW = 250;
        const maxLogoH = 78;
        const ratio = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
        const drawW = Math.max(1, logo.width * ratio);
        const drawH = Math.max(1, logo.height * ratio);
        const logoX = width - padding - drawW - 24;
        const logoY = y + 20;
        ctx.drawImage(logo, logoX, logoY, drawW, drawH);
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 52px serif";
      ctx.fillText("INVOICE", padding + 28, y + 58);
      ctx.font = "28px serif";
      ctx.fillText(invoice.invoice_number || "-", padding + 28, y + 96);
      ctx.font = "24px serif";
      ctx.fillText(
        `Total: ${invoice.currency} ${totalAmount.toFixed(2)}`,
        width - padding - 430,
        y + 76,
      );
      y += 150;

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(padding, y, width - padding * 2, 220, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#1f2937";
      ctx.font = "24px serif";
      const leftRows = [
        line("Client", invoice.client_name),
        line("Client Email", invoice.client_email),
        line("Status", getInvoiceStatusLabel(invoice.status)),
        line(
          "Type",
          invoice.invoice_type === "one_time"
            ? "One Time Payment"
            : "Milestone",
        ),
      ];
      const rightRows = [
        line("Sender", invoice.sender_signer_email),
        line("Receiver", invoice.receiver_signer_email),
        line(
          "Due Date",
          invoice.due_date
            ? new Date(invoice.due_date).toLocaleDateString()
            : "-",
        ),
        line("Currency", invoice.currency),
      ];
      let y1 = y + 42;
      leftRows.forEach((row) => {
        ctx.fillText(row, padding + 24, y1);
        y1 += 42;
      });
      let y2 = y + 42;
      rightRows.forEach((row) => {
        ctx.fillText(row, width / 2 + 20, y2);
        y2 += 42;
      });
      y += 254;

      if (invoice.description) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#d1d5db";
        ctx.beginPath();
        ctx.roundRect(padding, y, width - padding * 2, 98, 16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#1f2937";
        ctx.font = "22px serif";
        ctx.fillText(
          `Description: ${invoice.description}`,
          padding + 24,
          y + 56,
        );
        y += 124;
      }

      ctx.fillStyle = "#111827";
      ctx.font = "700 32px serif";
      ctx.fillText("Milestones & Signature Details", padding, y);
      y += 20;

      editableMilestones.forEach((entry, index) => {
        y += 20;
        const cardH = 280;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#d1d5db";
        ctx.beginPath();
        ctx.roundRect(padding, y, width - padding * 2, cardH, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#1f2937";
        ctx.font = "700 24px serif";
        ctx.fillText(
          `Milestone ${index + 1}: ${entry.item || "-"}`,
          padding + 20,
          y + 40,
        );
        ctx.font = "22px serif";
        ctx.fillText(
          `Amount: ${invoice.currency} ${Number(entry.amount || 0).toFixed(2)}`,
          padding + 20,
          y + 72,
        );

        const colGap = 16;
        const colW = (width - padding * 2 - 40 - colGap) / 2;
        const colY = y + 90;
        const colLeftX = padding + 20;
        const colRightX = colLeftX + colW + colGap;

        const drawSigPanel = (
          x: number,
          title: string,
          signature: string | undefined,
          emailValue: string | null | undefined,
          ipValue: string | undefined,
          cityValue: string | undefined,
          countryValue: string | undefined,
          signedAtValue: string | undefined,
        ) => {
          ctx.fillStyle = "#f9fafb";
          ctx.strokeStyle = "#e5e7eb";
          ctx.beginPath();
          ctx.roundRect(x, colY, colW, 170, 12);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#111827";
          ctx.font = "700 20px serif";
          ctx.fillText(title, x + 12, colY + 28);
          ctx.fillStyle = "#374151";
          ctx.font = "17px serif";
          const rows = [
            line("Signature", signature || "-"),
            line("Email", emailValue || "-"),
            line("IP", ipValue || "-"),
            line("Location", `${cityValue || "-"}, ${countryValue || "-"}`),
            line(
              "Signed At",
              signedAtValue ? new Date(signedAtValue).toLocaleString() : "-",
            ),
          ];
          let yy = colY + 56;
          rows.forEach((row) => {
            ctx.fillText(row, x + 12, yy);
            yy += 24;
          });
        };

        drawSigPanel(
          colLeftX,
          "Sender Signature",
          entry.sender_signature_text,
          invoice.sender_signer_email,
          entry.sender_signed_by_ip,
          entry.sender_signed_by_city,
          entry.sender_signed_by_country,
          entry.sender_signed_at,
        );
        drawSigPanel(
          colRightX,
          "Receiver Signature",
          entry.receiver_signature_text,
          invoice.receiver_signer_email,
          entry.receiver_signed_by_ip,
          entry.receiver_signed_by_city,
          entry.receiver_signed_by_country,
          entry.receiver_signed_at,
        );
        y += cardH;
      });

      ctx.fillStyle = "#6b7280";
      ctx.font = "18px serif";
      ctx.fillText(
        "Generated by BitsShake",
        padding,
        Math.min(y + 40, height - 28),
      );

      const dataUrl = canvas.toDataURL("image/png");
      const link = globalThis.document.createElement("a");
      link.href = dataUrl;
      link.download = `${(invoice.invoice_number || "invoice").replace(/\s+/g, "_")}.png`;
      globalThis.document.body.appendChild(link);
      link.click();
      link.remove();
      setShowDownloadModal(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to download PNG";
      setToast({
        id: String(Date.now()),
        message,
        type: "error",
      });
    } finally {
      setDownloadingFile(false);
    }
  };

  const getSignatureFontFamily = (style: string) => {
    if (style === "script") {
      return "'Brush Script MT', 'Segoe Script', cursive";
    }
    if (style === "normal") {
      return "inherit";
    }
    return "'Comic Sans MS', 'Bradley Hand', cursive";
  };

  const openSignatureModal = (
    entry: EditableMilestone,
    role: "sender" | "receiver",
    milestoneIndex: number,
  ) => {
    const isCurrentMilestoneUnlocked =
      milestoneIndex === 0 ||
      editableMilestones
        .slice(0, milestoneIndex)
        .every(
          (m) =>
            !!(m.sender_signature_text || "").trim() &&
            !!(m.receiver_signature_text || "").trim(),
        );

    if (!isCurrentMilestoneUnlocked) {
      setToast({
        id: String(Date.now()),
        message:
          "Previous milestone must be signed by both sender and receiver first",
        type: "error",
      });
      return;
    }

    const isSender = role === "sender";
    const existingSignature = isSender
      ? entry.sender_signature_text || ""
      : entry.receiver_signature_text || "";
    const existingStyleRaw = isSender
      ? entry.sender_signature_style || "cursive"
      : entry.receiver_signature_style || "cursive";
    const existingStyle =
      existingStyleRaw === "script" || existingStyleRaw === "normal"
        ? existingStyleRaw
        : "cursive";

    setSignatureInput(existingSignature);
    setSignatureStyleInput(existingStyle);
    setSignatureModal({
      milestoneIndex,
      role,
      email: isSender
        ? invoice.sender_signer_email || "-"
        : invoice.receiver_signer_email || "-",
      signatureText: existingSignature,
      signatureStyle: existingStyle,
      milestoneItem: entry.item || "Milestone",
      signedByIp: isSender
        ? entry.sender_signed_by_ip || "Unknown"
        : entry.receiver_signed_by_ip || "Unknown",
      signedByCity: isSender
        ? entry.sender_signed_by_city || "Unknown"
        : entry.receiver_signed_by_city || "Unknown",
      signedByCountry: isSender
        ? entry.sender_signed_by_country || "Unknown"
        : entry.receiver_signed_by_country || "Unknown",
      signedAt: isSender
        ? entry.sender_signed_at || ""
        : entry.receiver_signed_at || "",
    });
  };

  const saveMilestoneSignature = async () => {
    if (!signatureModal || !invoice?.id) return;
    const actorEmail = normalizedActorEmail;

    if (!actorEmail) {
      setToast({
        id: String(Date.now()),
        message: "Unable to identify signer",
        type: "error",
      });
      return;
    }

    if (!signatureInput.trim()) {
      setToast({
        id: String(Date.now()),
        message: "Please type your signature",
        type: "error",
      });
      return;
    }

    setSavingSignature(true);
    try {
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      const ipData = ipResponse.ok ? await ipResponse.json() : null;
      const ip = (ipData?.ip || "Unknown").toString();

      let city = "Unknown";
      let country = "Unknown";
      if (ip && ip !== "Unknown") {
        const geoResponse = await fetch(
          `/api/get-location?ip=${encodeURIComponent(ip)}`,
        );
        const geoData = geoResponse.ok ? await geoResponse.json() : null;
        city = (geoData?.city || "Unknown").toString();
        country = (geoData?.country || "Unknown").toString();
      }

      const response = await fetch("/api/update-invoice-milestone-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          actorEmail,
          milestoneIndex: signatureModal.milestoneIndex,
          role: signatureModal.role,
          signatureText: signatureInput.trim(),
          signatureStyle: signatureStyleInput,
          ip,
          city,
          country,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save signature");
      }

      setEditableMilestones((prev) =>
        prev.map((row, index) =>
          index === signatureModal.milestoneIndex
            ? signatureModal.role === "sender"
              ? {
                  ...row,
                  sender_signature_text: signatureInput.trim(),
                  sender_signature_style: signatureStyleInput,
                  sender_signed_by_ip: ip,
                  sender_signed_by_city: city,
                  sender_signed_by_country: country,
                  sender_signed_at: new Date().toISOString(),
                }
              : {
                  ...row,
                  receiver_signature_text: signatureInput.trim(),
                  receiver_signature_style: signatureStyleInput,
                  receiver_signed_by_ip: ip,
                  receiver_signed_by_city: city,
                  receiver_signed_by_country: country,
                  receiver_signed_at: new Date().toISOString(),
                }
            : row,
        ),
      );

      setInvoice((prev) => {
        if (!prev || !Array.isArray(prev.milestones)) return prev;
        const nextMilestones = [...prev.milestones];
        const current = nextMilestones[signatureModal.milestoneIndex] || {
          item: "",
          amount: 0,
        };
        nextMilestones[signatureModal.milestoneIndex] =
          signatureModal.role === "sender"
            ? {
                ...current,
                sender_signature_text: signatureInput.trim(),
                sender_signature_style: signatureStyleInput,
                sender_signed_by_ip: ip,
                sender_signed_by_city: city,
                sender_signed_by_country: country,
                sender_signed_at: new Date().toISOString(),
              }
            : {
                ...current,
                receiver_signature_text: signatureInput.trim(),
                receiver_signature_style: signatureStyleInput,
                receiver_signed_by_ip: ip,
                receiver_signed_by_city: city,
                receiver_signed_by_country: country,
                receiver_signed_at: new Date().toISOString(),
              };
        return {
          ...prev,
          milestones: nextMilestones,
          status: (data?.status || prev.status) as Invoice["status"],
        };
      });

      setSignatureModal((prev) =>
        prev
          ? {
              ...prev,
              signatureText: signatureInput.trim(),
              signatureStyle: signatureStyleInput,
              signedByIp: ip,
              signedByCity: city,
              signedByCountry: country,
              signedAt: new Date().toISOString(),
            }
          : prev,
      );

      setToast({
        id: String(Date.now()),
        message: "Signature saved successfully",
        type: "success",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save signature";
      setToast({
        id: String(Date.now()),
        message,
        type: "error",
      });
    } finally {
      setSavingSignature(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-900 font-serif">Invoice not found.</p>
          <Link href="/invoices">
            <button className="mt-4 px-6 py-2 bg-black text-white rounded-full font-serif">
              Back to Invoices
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showShareEmailModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">
                Share Invoice?
              </h3>
              <p className="text-gray-600">
                Send this invoice to {shareRecipients.length} recipient
                {shareRecipients.length !== 1 ? "s" : ""} via email?
              </p>
              <div className="flex gap-3 w-full mt-6">
                <button
                  onClick={() => setShowShareEmailModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShareViaEmail}
                  disabled={sendingShareEmail}
                  className="flex-1 px-6 py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {sendingShareEmail ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShareLinkModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Share Links
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Copy and share links with recipients.
            </p>
            <div className="space-y-4 max-h-72 overflow-y-auto">
              {shareRecipients.map((recipientEmail) => (
                <div
                  key={recipientEmail}
                  className="border border-gray-200 rounded p-3 flex items-center justify-between gap-2"
                >
                  <span className="font-medium text-gray-900 text-sm break-all">
                    {recipientEmail}
                  </span>
                  <button
                    onClick={() => copyRecipientLink(recipientEmail)}
                    className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                  >
                    Copy Link
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShareLinkModal(false)}
              className="w-full mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showDownloadModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900 font-serif">
              Download Invoice
            </h3>
            <p className="text-sm text-gray-600 mt-2 font-serif">
              Choose file format: PDF or PNG. Export includes all invoice
              details and signature metadata.
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={downloadInvoiceAsPDF}
                disabled={downloadingFile}
                className="w-full px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-50 font-serif"
              >
                {downloadingFile ? "Preparing..." : "Download PDF"}
              </button>
              <button
                onClick={downloadInvoiceAsPNG}
                disabled={downloadingFile}
                className="w-full px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-50 font-serif"
              >
                {downloadingFile ? "Preparing..." : "Download PNG"}
              </button>
              <button
                onClick={() => setShowDownloadModal(false)}
                disabled={downloadingFile}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 disabled:opacity-50 font-serif"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {signatureModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            {(() => {
              const isAlreadySigned = !!signatureModal.signedAt;
              const canSignThisRole =
                (signatureModal.role === "sender" && isSenderView) ||
                (signatureModal.role === "receiver" && isReceiverView);
              const isReadOnly = isAlreadySigned || !canSignThisRole;
              return (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 font-serif">
                    {signatureModal.role === "sender"
                      ? "Sender Signature"
                      : "Receiver Signature"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-serif">
                    Milestone: {signatureModal.milestoneItem}
                  </p>
                  <div className="mt-4 border-t-2 border-gray-900 pt-4">
                    <label className="block text-xs text-gray-500 mb-1 font-serif">
                      Type signature
                    </label>
                    <input
                      type="text"
                      value={signatureInput}
                      onChange={(e) => setSignatureInput(e.target.value)}
                      disabled={isReadOnly}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-serif disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="Enter signature text"
                    />
                    <label className="block text-xs text-gray-500 mt-3 mb-1 font-serif">
                      Signature style
                    </label>
                    <select
                      value={signatureStyleInput}
                      onChange={(e) =>
                        setSignatureStyleInput(
                          e.target.value as "cursive" | "script" | "normal",
                        )
                      }
                      disabled={isReadOnly}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-serif disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="cursive">Cursive</option>
                      <option value="script">Script</option>
                      <option value="normal">Normal</option>
                    </select>
                    <p
                      className="text-3xl text-gray-900 min-h-[44px] mt-4"
                      style={{
                        fontFamily: getSignatureFontFamily(signatureStyleInput),
                      }}
                    >
                      {signatureInput || "_________________"}
                    </p>
                    <p className="text-sm text-gray-600 mt-2 font-serif">
                      {signatureModal.email}
                    </p>
                    {signatureModal.signedAt && (
                      <div className="mt-3 text-xs text-gray-600 space-y-1 font-serif">
                        <p>IP: {signatureModal.signedByIp || "Unknown"}</p>
                        <p>
                          Location: {signatureModal.signedByCity || "Unknown"},{" "}
                          {signatureModal.signedByCountry || "Unknown"}
                        </p>
                        <p>
                          Signed At:{" "}
                          {new Date(signatureModal.signedAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setSignatureModal(null)}
                      className={`${isReadOnly ? "w-full" : "flex-1"} px-4 py-2 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 font-serif`}
                    >
                      Close
                    </button>
                    {!isReadOnly && (
                      <button
                        onClick={saveMilestoneSignature}
                        disabled={savingSignature}
                        className="flex-1 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-50 font-serif"
                      >
                        {savingSignature ? "Saving..." : "Sign"}
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <header className="shadow">
        <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isPublicView && (
                <Link href="/invoices">
                  <button className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-black/80 transition-colors font-serif">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                </Link>
              )}
              <h1 className="text-3xl font-bold text-gray-900">Invoice</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize bg-gray-100 text-gray-800">
                {getInvoiceStatusLabel(invoice.status)}
              </span>
              <button
                onClick={() => setShowDownloadModal(true)}
                className="font-serif px-4 py-2 bg-black text-white border border-black rounded-4xl hover:bg-gray-800 flex items-center justify-center gap-2 cursor-pointer"
              >
                Download
              </button>

              {isDocumentOwner && (
                <div className="relative" ref={sharePopoverRef}>
                  <button
                    onClick={() => setShowSharePopover((v) => !v)}
                    disabled={sendingShareEmail}
                    className="font-serif px-4 py-2 bg-black text-white border border-black rounded-4xl hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:border-gray-400 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {sendingShareEmail ? "Sharing..." : "Share"}
                  </button>
                  {showSharePopover && (
                    <div className="absolute right-0 mt-2 w-52 bg-white border border-black rounded-xl shadow-xl z-50 overflow-hidden">
                      <button
                        onClick={() => {
                          setShowSharePopover(false);
                          setShowShareEmailModal(true);
                        }}
                        className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-100 font-serif cursor-pointer"
                      >
                        Share via Email
                      </button>
                      <div className="border-t border-black/10" />
                      <button
                        onClick={() => {
                          setShowSharePopover(false);
                          setShowShareLinkModal(true);
                        }}
                        className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-100 font-serif cursor-pointer"
                      >
                        Share Link
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                Invoice Number
              </p>
              <p className="text-lg text-gray-900 font-serif">
                {invoice.invoice_number}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                Type
              </p>
              <p className="text-lg text-gray-900 font-serif capitalize">
                {invoice.invoice_type === "one_time"
                  ? "One Time Payment"
                  : "Milestone"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                Client Name
              </p>
              <p className="text-lg text-gray-900 font-serif">
                {invoice.client_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                Client Email
              </p>
              <p className="text-lg text-gray-900 font-serif">
                {invoice.client_email || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                Sender Signer Email
              </p>
              <p className="text-lg text-gray-900 font-serif">
                {invoice.sender_signer_email || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                Receiver Signer Email
              </p>
              <p className="text-lg text-gray-900 font-serif">
                {invoice.receiver_signer_email || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                Due Date
              </p>
              <p className="text-lg text-gray-900 font-serif">
                {invoice.due_date
                  ? new Date(invoice.due_date).toLocaleDateString()
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                Total
              </p>
              <p className="text-lg text-gray-900 font-serif">
                {invoice.currency} {totalAmount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                Remaining Amount To Be Paid
              </p>
              <p className="text-lg text-gray-900 font-serif">
                {invoice.currency} {remainingAmountToBePaid.toFixed(2)}
              </p>
            </div>
          </div>

          {invoice.description && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                Description
              </p>
              <p className="mt-1 text-gray-900 font-serif">
                {invoice.description}
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-serif">
                {invoice.invoice_type === "milestone" ? "Milestones" : "Item"}
              </p>
              {canEditMilestones && (
                <div className="flex items-center gap-2">
                  {invoice.invoice_type === "milestone" && (
                    <button
                      onClick={addMilestoneRow}
                      className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-gray-800 font-serif"
                    >
                      + Add Milestone
                    </button>
                  )}
                  <button
                    onClick={saveMilestones}
                    disabled={savingMilestones}
                    className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-gray-800 disabled:opacity-50 font-serif"
                  >
                    {savingMilestones ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                      Item
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                      Sender Signature
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                      Receiver Signature
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                      Delete
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {editableMilestones.length > 0 ? (
                    editableMilestones.map((entry, index) => {
                      const rowLocked =
                        !!entry.sender_signature_text ||
                        !!entry.receiver_signature_text;
                      const isCurrentMilestoneUnlocked =
                        index === 0 ||
                        editableMilestones
                          .slice(0, index)
                          .every(
                            (m) =>
                              !!(m.sender_signature_text || "").trim() &&
                              !!(m.receiver_signature_text || "").trim(),
                          );

                      return (
                        <tr key={entry.id}>
                          <td className="px-4 py-2 text-sm text-gray-900 font-serif">
                            {canEditMilestones ? (
                              <input
                                type="text"
                                value={entry.item}
                                onChange={(e) =>
                                  updateMilestoneRow(
                                    entry.id,
                                    "item",
                                    e.target.value,
                                  )
                                }
                                disabled={rowLocked}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-serif disabled:bg-gray-100 disabled:text-gray-500"
                              />
                            ) : (
                              entry.item
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 font-serif text-right">
                            {canEditMilestones ? (
                              <div className="flex items-center justify-end gap-2">
                                <span>{invoice.currency}</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={entry.amount}
                                  onChange={(e) =>
                                    updateMilestoneRow(
                                      entry.id,
                                      "amount",
                                      e.target.value,
                                    )
                                  }
                                  disabled={rowLocked}
                                  className="w-28 px-2 py-1 border border-gray-300 rounded text-sm font-serif text-right disabled:bg-gray-100 disabled:text-gray-500"
                                />
                              </div>
                            ) : (
                              `${invoice.currency} ${Number(entry.amount || 0).toFixed(2)}`
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() =>
                                openSignatureModal(entry, "sender", index)
                              }
                              disabled={!isCurrentMilestoneUnlocked}
                              className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed font-serif"
                            >
                              {entry.sender_signature_text
                                ? "View Signature"
                                : "Not Signed"}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() =>
                                openSignatureModal(entry, "receiver", index)
                              }
                              disabled={!isCurrentMilestoneUnlocked}
                              className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed font-serif"
                            >
                              {entry.receiver_signature_text
                                ? "View Signature"
                                : "Not Signed"}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {canEditMilestones &&
                            invoice.invoice_type === "milestone" &&
                            editableMilestones.length > 1 &&
                            !rowLocked ? (
                              <button
                                onClick={() => removeMilestoneRow(entry.id)}
                                className="inline-flex items-center px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 text-xs font-serif"
                              >
                                Delete
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 font-serif">
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        className="px-4 py-3 text-sm text-gray-500 font-serif"
                        colSpan={5}
                      >
                        No items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
