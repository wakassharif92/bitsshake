// (Removed duplicate ViewDocument function. The main implementation follows below.)
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Document,
  Recipient,
  AuditLog,
  ChatMessage,
  User,
  Invoice,
} from "@/lib/types";
import { hasPremiumAccess } from "@/lib/subscription";
import ChatPanel from "@/components/ChatPanel";
import Toast, { ToastMessage } from "@/components/Toast";

export default function ViewDocument() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [showSendPopover, setShowSendPopover] = useState(false);
  const [sendingDocument, setSendingDocument] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertReason, setRevertReason] = useState("");
  const [revertingDocument, setRevertingDocument] = useState(false);
  const [showAttachInvoiceModal, setShowAttachInvoiceModal] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [attachingInvoice, setAttachingInvoice] = useState(false);
  const [attachedInvoiceIds, setAttachedInvoiceIds] = useState<string[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [showDetachInvoiceModal, setShowDetachInvoiceModal] = useState(false);
  const [detachingInvoice, setDetachingInvoice] = useState(false);
  const [detachInvoiceReason, setDetachInvoiceReason] = useState("");
  const [invoiceToDetach, setInvoiceToDetach] = useState<Invoice | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const sendPopoverRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<
    "conversation" | "logs" | "recipients" | "invoice"
  >("conversation");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  // Send via Email (same as edit page)
  const handleSendViaEmail = async () => {
    if (!hasPremiumAccess(currentUserData) && !isPublicView) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      return;
    }
    if (!id || recipients.length === 0) {
      alert("Please add at least one recipient before sending");
      return;
    }
    setShowSendEmailModal(true);
  };

  const confirmSendViaEmail = async () => {
    setShowSendEmailModal(false);
    setSendingDocument(true);
    try {
      // Get auth session for the token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Update document status first
      await supabase.from("documents").update({ status: "sent" }).eq("id", id);

      // Send emails to recipients with auth token
      const response = await fetch("/api/send-signing-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ documentId: id }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Error sending emails: ${data.error}`);
        return;
      }

      alert(data.message || "Document sent to recipients!");
    } catch (err: any) {
      alert("Error sending document: " + err.message);
    } finally {
      setSendingDocument(false);
    }
  };
  const handleSendViaLink = () => {
    if (!hasPremiumAccess(currentUserData) && !isPublicView) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      return;
    }
    setShowLinkModal(true);
  };

  const handleOpenRevertModal = () => {
    if (!document || document.status !== "sent") return;
    setRevertReason("");
    setShowRevertModal(true);
  };

  const confirmRevertDocument = async () => {
    if (!id || !document) return;

    const reason = revertReason.trim();
    if (!reason) {
      alert("Please provide a revert reason.");
      return;
    }

    if (!canRevertDocument) {
      alert("You are not allowed to revert this document.");
      return;
    }

    setRevertingDocument(true);
    try {
      const response = await fetch("/api/revert-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: String(id),
          senderEmail: currentUserEmail,
          actorEmail: currentUserEmail,
          actorName: currentUserName || "Signer",
          reason,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to revert document");
      }

      setDocument((prev) => (prev ? { ...prev, status: "revert" } : prev));

      setShowRevertModal(false);
      setRevertReason("");
      if (isDocumentAdmin) {
        router.push(`/documents/${id}/edit`);
      } else {
        setToast({
          id: String(Date.now()),
          message: data.message || "Document reverted successfully",
          type: "success",
        });
      }
    } catch (err: any) {
      alert("Error reverting document: " + err.message);
    } finally {
      setRevertingDocument(false);
    }
  };

  const openAttachInvoiceModal = async () => {
    if (!document?.admin_id) return;
    if (!hasPremiumAccess(currentUserData) && !isPublicView) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      return;
    }
    setSelectedInvoiceIds([]);
    await loadInvoices(document.admin_id);
    setShowAttachInvoiceModal(true);
  };

  const handleAttachInvoice = async () => {
    if (!id || !document) return;
    if (!hasPremiumAccess(currentUserData) && !isPublicView) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      return;
    }
    if (selectedInvoiceIds.length === 0) {
      alert("Please select at least one invoice.");
      return;
    }

    setAttachingInvoice(true);
    try {
      const payload = selectedInvoiceIds.map((invoiceId) => ({
        document_id: String(id),
        invoice_id: invoiceId,
      }));

      const { error } = await supabase
        .from("document_invoices")
        .upsert(payload, { onConflict: "document_id,invoice_id" });

      if (error) throw error;
      await loadAttachedInvoices(String(id));
      setShowAttachInvoiceModal(false);
      setSelectedInvoiceIds([]);

      const attachedNow = invoices.filter((inv) =>
        selectedInvoiceIds.includes(inv.id),
      );
      const message = `[INVOICE_ATTACH] ${attachedNow
        .map((inv) => inv.invoice_number || inv.client_name || inv.id)
        .join(", ")}`;
      await fetch("/api/chat-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: String(id),
          message,
          senderEmail: currentUserEmail,
          senderName: currentUserName || "Admin",
        }),
      });
      setToast({
        id: String(Date.now()),
        message: "Invoice(s) attached successfully.",
        type: "success",
      });
    } catch (err: any) {
      const message = String(err?.message || "Unknown error");
      if (
        message.includes(
          "Could not find the table 'public.document_invoices' in the schema cache",
        )
      ) {
        alert(
          "Database is missing document_invoices table in API cache.\n\nRun this SQL in Supabase SQL Editor:\nCREATE TABLE IF NOT EXISTS document_invoices (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,\n  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,\n  created_at timestamp DEFAULT now(),\n  UNIQUE(document_id, invoice_id)\n);\nNOTIFY pgrst, 'reload schema';\n\nThen try attaching again.",
        );
      } else {
        alert("Error attaching invoice: " + message);
      }
    } finally {
      setAttachingInvoice(false);
    }
  };

  const handleDetachInvoice = (invoiceId: string) => {
    const target = attachedInvoices.find((item) => item.id === invoiceId) || null;
    setInvoiceToDetach(target);
    setDetachInvoiceReason("");
    setShowDetachInvoiceModal(true);
  };

  const confirmDetachInvoice = async () => {
    if (!id || !invoiceToDetach) return;
    const reason = detachInvoiceReason.trim();
    if (!reason) {
      alert("Please provide a detach reason.");
      return;
    }

    setDetachingInvoice(true);
    try {
      const { error } = await supabase
        .from("document_invoices")
        .delete()
        .eq("document_id", String(id))
        .eq("invoice_id", invoiceToDetach.id);

      if (error) throw error;
      setAttachedInvoiceIds((prev) =>
        prev.filter((item) => item !== invoiceToDetach.id),
      );

      await fetch("/api/chat-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: String(id),
          message: `[INVOICE_DETACH] ${invoiceToDetach.invoice_number || invoiceToDetach.client_name || invoiceToDetach.id} || ${reason}`,
          senderEmail: currentUserEmail,
          senderName: currentUserName || "Admin",
        }),
      });

      setShowDetachInvoiceModal(false);
      setInvoiceToDetach(null);
      setDetachInvoiceReason("");
      setToast({
        id: String(Date.now()),
        message: "Invoice detached successfully.",
        type: "success",
      });
    } catch (err: any) {
      alert("Error detaching invoice: " + err.message);
    } finally {
      setDetachingInvoice(false);
    }
  };
  const router = useRouter();
  const { id, email } = router.query;
  const [document, setDocument] = useState<Document | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPublicView, setIsPublicView] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [chatSignatures, setChatSignatures] = useState<ChatMessage[]>([]);
  const hasLoggedOpenRef = useRef(false);

  const loadInvoices = useCallback(async (adminId: string) => {
    setLoadingInvoices(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("admin_id", adminId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInvoices((data || []) as Invoice[]);
    } catch (err: any) {
      alert("Error loading invoices: " + err.message);
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  const loadAttachedInvoices = useCallback(async (documentId: string) => {
    try {
      const { data, error } = await supabase
        .from("document_invoices")
        .select("invoice_id")
        .eq("document_id", documentId);
      if (error) throw error;
      const ids = ((data || []) as Array<{ invoice_id: string }>)
        .map((row) => row.invoice_id)
        .filter(Boolean);
      setAttachedInvoiceIds(ids);
    } catch (err: any) {
      console.error("Error loading attached invoices:", err);
      setAttachedInvoiceIds([]);
    }
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("config")
        .select("isEnable")
        .eq("key", "showlocation")
        .single();

      if (!error && data) {
        setShowLocation(data.isEnable === true);
      }
    } catch (err) {
      console.error("Error fetching config:", err);
      setShowLocation(true); // Default to showing location if fetch fails
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!showSendPopover) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (sendPopoverRef.current && !sendPopoverRef.current.contains(target)) {
        setShowSendPopover(false);
      }
    };

    globalThis.document.addEventListener("mousedown", handleClickOutside);
    return () => {
      globalThis.document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSendPopover]);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const logDocumentOpened = async (actorEmail: string, source: string) => {
        if (hasLoggedOpenRef.current) return;
        try {
          const ipResponse = await fetch("https://api.ipify.org?format=json");
          const ipData = ipResponse.ok ? await ipResponse.json() : null;
          const ip = ipData?.ip;

          let locationLabel = "Unknown";
          if (ip) {
            const geoResponse = await fetch(
              `/api/get-location?ip=${encodeURIComponent(ip)}`,
            );
            if (geoResponse.ok) {
              const geoData = await geoResponse.json();
              const city = geoData.city || "Unknown";
              const country = geoData.country || "Unknown";
              locationLabel = `${city}, ${country}`;
            }
          }

          const clientTime = new Date().toLocaleString();
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const logEntry: AuditLog = {
            id: `local-${Date.now()}`,
            document_id: String(id),
            action: "DOCUMENT_OPENED",
            actor_email: actorEmail,
            ip_address: ip,
            user_agent: navigator.userAgent,
            details: {
              location: locationLabel,
              source,
              client_time: clientTime,
              time_zone: timeZone,
            },
            timestamp: new Date().toISOString(),
          };

          const logResponse = await fetch("/api/log-document-open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentId: String(id),
              actorEmail,
              ip,
              userAgent: navigator.userAgent,
              location: locationLabel,
              source,
              clientTime,
              timeZone,
            }),
          });

          if (!logResponse.ok) {
            const logData = await logResponse.json();
            throw new Error(logData?.error || "Failed to log document open");
          }

          setAuditLogs((prev) => [logEntry, ...prev]);

          hasLoggedOpenRef.current = true;
        } catch (err) {
          console.error("Error logging document open:", err);
        }
      };
      const fetchChatSignatures = async (userEmail: string) => {
        try {
          const chatResponse = await fetch(
            `/api/chat-messages?documentId=${encodeURIComponent(
              String(id),
            )}&userEmail=${encodeURIComponent(userEmail)}`,
          );
          if (chatResponse.ok) {
            const chatData = await chatResponse.json();
            const messages: ChatMessage[] = chatData.messages || [];
            const signatures = messages.filter((m) =>
              m.message?.startsWith("[SIGNATURE]"),
            );
            setChatSignatures(signatures);
          } else {
            setChatSignatures([]);
          }
        } catch (err) {
          console.error("Error fetching chat signatures:", err);
          setChatSignatures([]);
        }
      };

      const emailFromLink = typeof email === "string" ? email : "";
      if (emailFromLink) {
        setIsPublicView(true);
        setCurrentUserEmail(emailFromLink);
        await fetchChatSignatures(emailFromLink);

        const response = await fetch(
          `/api/public-document?documentId=${encodeURIComponent(
            String(id),
          )}&email=${encodeURIComponent(emailFromLink)}`,
        );

        if (!response.ok) {
          router.push("/");
          return;
        }

        const data = await response.json();
        setDocument(data.document || null);
        setRecipients(data.recipients || []);
        await loadAttachedInvoices(String(id));

        const currentRecipient = (data.recipients || []).find(
          (r: Recipient) => r.email === emailFromLink,
        );
        setCurrentUserName(currentRecipient?.name || emailFromLink);
        await logDocumentOpened(emailFromLink, "public_link");

        setAuditLogs([]);
        setLoading(false);
        return;
      }

      // Get current user
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      setCurrentUserId(userId);

      if (userId) {
        setIsPublicView(false);
        setCurrentUserEmail(session?.user?.email || "");
        setCurrentUserName(
          session?.user?.user_metadata?.full_name || session?.user?.email || "",
        );
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();
        setCurrentUserData(userData || null);
        await fetchChatSignatures(session?.user?.email || "");

        // Fetch document
        const { data: docData } = await supabase
          .from("documents")
          .select("*")
          .eq("id", id)
          .single();

        if (!docData) {
          router.push("/dashboard");
          return;
        }

        setDocument(docData);
        await loadAttachedInvoices(String(id));
        if (userId === docData.admin_id) {
          await loadInvoices(docData.admin_id);
        }

        // Fetch recipients
        const { data: recipientsData } = await supabase
          .from("recipients")
          .select("*")
          .eq("document_id", id)
          .order("created_at", { ascending: false });

        setRecipients(recipientsData || []);

        // Fetch audit logs
        const { data: logsData } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("document_id", id)
          .order("timestamp", { ascending: false });

        setAuditLogs(logsData || []);
        setLoading(false);
        await logDocumentOpened(session?.user?.email || "", "dashboard_view");
        return;
      }
    };

    fetchData();
  }, [email, id, loadAttachedInvoices, loadInvoices, router]);

  const getSignatureFontFamily = (style: string) => {
    if (style === "script") {
      return "'Brush Script MT', 'Segoe Script', cursive";
    }
    if (style === "normal") {
      return "inherit";
    }
    return "'Comic Sans MS', 'Bradley Hand', cursive";
  };

  const parseChatSignature = (message?: string) => {
    const signatureBody = message
      ? message.replace("[SIGNATURE]", "").trim()
      : "";
    const [sigName, sigReason, sigStyleRaw] = signatureBody
      ? signatureBody.split("||").map((part) => part.trim())
      : ["", "", ""];
    const sigStyle =
      sigStyleRaw === "script" || sigStyleRaw === "normal"
        ? sigStyleRaw
        : "cursive";
    return {
      sigName,
      sigReason,
      sigStyle,
      signatureFontFamily: getSignatureFontFamily(sigStyle),
    };
  };

  const handleDownloadPDF = async () => {
    if (!hasPremiumAccess(currentUserData) && !isPublicView) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      return;
    }
    // Only check signers for completion
    const signers = recipients.filter((r) => r.role === "signer");
    const allSignersSigned =
      signers.length > 0 && signers.every((r) => r.status === "signed");
    if (!allSignersSigned) {
      const unsigned = signers.filter((r) => r.status !== "signed");
      alert(
        `Document cannot be downloaded until all signers have signed.\n\nPending signatures from:\n${unsigned.map((r) => r.email).join("\n")}`,
      );
      return;
    }
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: String(id) }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      const filename =
        (document?.title || "document").replace(/\s+/g, "_") + ".pdf";

      link.href = url;
      link.download = filename;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to download PDF: ${err.message || "Unknown error"}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!document) {
    return <div>Document not found</div>;
  }

  const hasAccess = isPublicView ? true : hasPremiumAccess(currentUserData);
  const isDocumentAdmin =
    !isPublicView && !!currentUserId && currentUserId === document.admin_id;
  const normalizedCurrentEmail = (currentUserEmail || "").trim().toLowerCase();
  const isCurrentSigner = recipients.some(
    (r) =>
      (r.email || "").trim().toLowerCase() === normalizedCurrentEmail &&
      r.role === "signer",
  );
  const canRevertDocument = document.status === "sent" && (isDocumentAdmin || isCurrentSigner);
  const canManageInvoices = isDocumentAdmin;
  const attachedInvoices = attachedInvoiceIds
    .map((invoiceId) => invoices.find((inv) => inv.id === invoiceId))
    .filter(Boolean) as Invoice[];

  const getInvoiceRemainingAmount = (invoice: Invoice) => {
    const totalAmount = Number(invoice.total_amount ?? invoice.amount ?? 0);
    const milestones = Array.isArray(invoice.milestones)
      ? (invoice.milestones as Array<{
          amount?: number | string;
          sender_signature_text?: string;
          receiver_signature_text?: string;
        }>)
      : [];
    const completedAmount = milestones.reduce((sum, milestone) => {
      const isFullySigned =
        !!(milestone.sender_signature_text || "").trim() &&
        !!(milestone.receiver_signature_text || "").trim();
      if (!isFullySigned) return sum;
      const amount = Number(milestone.amount || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    return Math.max(totalAmount - completedAmount, 0);
  };

  const formatTimeAgo = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const seconds = Math.max(1, Math.floor(diffMs / 1000));
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
  };

  const aggregatedAuditLogs = (() => {
    const openMap = new Map<string, { count: number; lastLog: AuditLog }>();
    const others: AuditLog[] = [];

    auditLogs.forEach((log) => {
      if (log.action === "DOCUMENT_OPENED") {
        const key = `${log.actor_email || "unknown"}`;
        const existing = openMap.get(key);
        if (!existing) {
          openMap.set(key, { count: 1, lastLog: log });
        } else {
          const existingTime = new Date(existing.lastLog.timestamp).getTime();
          const currentTime = new Date(log.timestamp).getTime();
          const lastLog = currentTime > existingTime ? log : existing.lastLog;
          openMap.set(key, { count: existing.count + 1, lastLog });
        }
      } else {
        others.push(log);
      }
    });

    const openEntries = Array.from(openMap.values()).map((entry) => ({
      type: "open" as const,
      count: entry.count,
      log: entry.lastLog,
    }));

    const normalEntries = others.map((log) => ({
      type: "normal" as const,
      log,
    }));

    return [...openEntries, ...normalEntries].sort((a, b) => {
      const aTime = new Date(a.log.timestamp).getTime();
      const bTime = new Date(b.log.timestamp).getTime();
      return bTime - aTime;
    });
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Send Email Confirmation Modal */}
      {showSendEmailModal && (
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
                Send Document?
              </h3>
              <p className="text-gray-600">
                Send this document to all {recipients.length} recipient
                {recipients.length !== 1 ? "s" : ""}? They will receive signing
                links via email.
              </p>
              <div className="flex gap-3 w-full mt-6">
                <button
                  onClick={() => setShowSendEmailModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSendViaEmail}
                  disabled={sendingDocument}
                  className="flex-1 px-6 py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {sendingDocument ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRevertModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h14a4 4 0 110 8H9m0 0l4-4m-4 4l4 4"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">
                Revert Document?
              </h3>
              <p className="text-gray-600">
                Revert will unlock this sent document for editing and set
                its status to <strong>revert</strong>.
              </p>
              <div className="w-full text-left">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Revert reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why this document is being reverted..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent text-black"
                  disabled={revertingDocument}
                />
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => setShowRevertModal(false)}
                  disabled={revertingDocument}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRevertDocument}
                  disabled={revertingDocument || !revertReason.trim()}
                  className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {revertingDocument ? "Reverting..." : "Revert"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isPublicView && (
                <Link href="/dashboard">
                  <button className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer">
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
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {document.title}
                </h1>
                <div className="mt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full border border-red-600 text-red-600 text-xs font-semibold uppercase tracking-wide">
                    {document.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {(() => {
                const signers = recipients.filter((r) => r.role === "signer");
                const allSignersSigned =
                  signers.length > 0 &&
                  signers.every((r) => r.status === "signed");
                return (
                  <button
                    onClick={handleDownloadPDF}
                    disabled={!allSignersSigned || !hasAccess}
                    className="px-4 py-2 bg-white text-black border border-black rounded-4xl hover:bg-gray-50 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:border-gray-400 font-serif cursor-pointer"
                    title={
                      !hasAccess
                        ? "Upgrade to download"
                        : allSignersSigned
                          ? "Download signed document"
                          : "All signers must sign before download"
                    }
                  >
                    Download PDF
                  </button>
                );
              })()}
              {/* Show Send to Recipients button for admin only */}
              {isDocumentAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openAttachInvoiceModal}
                    disabled={attachingInvoice || !hasAccess}
                    className="font-serif px-4 py-2 bg-white text-black border border-black rounded-4xl hover:bg-gray-50 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:border-gray-400 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {attachingInvoice ? "Attaching..." : "Attach Invoice"}
                  </button>
                  <div className="relative" ref={sendPopoverRef}>
                    <button
                      onClick={() => setShowSendPopover((v) => !v)}
                      disabled={sendingDocument || !hasAccess}
                      className="font-serif px-4 py-2 bg-black text-white border border-black rounded-4xl hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:border-gray-400 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {sendingDocument ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full"></div>
                          Sending...
                        </>
                      ) : (
                        "Send Again"
                      )}
                    </button>
                    {showSendPopover && (
                      <div className="absolute right-0 mt-2 w-52 bg-white border border-black rounded-xl shadow-xl z-50 overflow-hidden">
                        <button
                          onClick={() => {
                            setShowSendPopover(false);
                            handleSendViaEmail();
                          }}
                          className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-100 font-serif cursor-pointer"
                          disabled={sendingDocument || !hasAccess}
                        >
                          Send via Email
                        </button>
                        <div className="border-t border-black/10" />
                        <button
                          onClick={() => {
                            setShowSendPopover(false);
                            handleSendViaLink();
                          }}
                          className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-100 font-serif cursor-pointer"
                          disabled={sendingDocument || !hasAccess}
                        >
                          View Links
                        </button>
                      </div>
                    )}
                  </div>
                  {canRevertDocument && (
                    <button
                      onClick={handleOpenRevertModal}
                      disabled={revertingDocument || !hasAccess}
                      className="font-serif px-4 py-2 bg-red-600 text-white border border-red-600 rounded-4xl hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:border-gray-400 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {revertingDocument ? "Reverting..." : "Revert"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {!isPublicView && !hasAccess && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your trial has ended. Upgrade to send, download, or use chat.
            <Link href="/pricing" className="ml-2 font-semibold underline">
              View pricing
            </Link>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Document content */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-8">
              <div className="prose prose-lg max-w-none text-black">
                <div
                  dangerouslySetInnerHTML={{ __html: document.content || "" }}
                  className="font-serif text-gray-900 leading-relaxed"
                  style={{ lineHeight: "1.75" }}
                />
              </div>

              {/* Signatures section */}
              {recipients.filter((r) => r.role === "signer").length > 0 && (
                <div className="mt-12 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 font-serif">
                    Signatures
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {recipients
                      .filter((r) => r.role === "signer")
                      .map((recipient) => (
                        <div
                          key={recipient.id}
                          className="border-t-2 border-gray-900 pt-4"
                        >
                          <p
                            style={{
                              fontSize: "24px",
                              fontFamily: "cursive",
                            }}
                            className="text-gray-900 mb-2"
                          >
                            {recipient.signature_text || "_________________"}
                          </p>
                          <p className="text-sm text-gray-600">
                            {recipient.email}
                          </p>
                          {recipient.signed_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              Signed:{" "}
                              {new Date(recipient.signed_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Discussion signatures section */}
              {chatSignatures.length > 0 && (
                <div className="mt-12 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">
                    Signature Agreement
                  </h3>
                  <div className="space-y-6">
                    {chatSignatures.map((sig) => {
                      const parsed = parseChatSignature(sig.message);
                      const title = parsed.sigReason
                        ? `${parsed.sigReason} Signature`
                        : "Signature";
                      return (
                        <div
                          key={sig.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <p className="text-sm font-semibold text-gray-900">
                            {title}
                          </p>
                          {parsed.sigName && (
                            <p
                              className="mt-2 text-2xl text-gray-900"
                              style={{
                                fontFamily: parsed.signatureFontFamily,
                              }}
                            >
                              {parsed.sigName}
                            </p>
                          )}
                          <div className="mt-2 text-xs text-gray-600 space-y-1">
                            <p>Name: {sig.sender_name || sig.sender_email}</p>
                            <p>Email: {sig.sender_email}</p>
                            {sig.sender_location && (
                              <p>Location: {sig.sender_location}</p>
                            )}
                            {sig.sender_ip && <p>IP: {sig.sender_ip}</p>}
                            <p>
                              Signed:{" "}
                              {new Date(sig.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details panel */}
          <div className="space-y-6">
            {/* Tabs */}
            <div className="bg-white shadow rounded-2xl">
              <div className="rounded-2xl flex flex-wrap gap-2 p-4 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("conversation")}
                  className={`px-4 py-2 rounded-4xl font-medium transition-colors text-[14px] font-serif cursor-pointer ${
                    activeTab === "conversation"
                      ? "bg-black text-white"
                      : "bg-transparent text-black border border-black hover:bg-gray-50"
                  }`}
                >
                  Conversation
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`px-4 py-1 rounded-4xl font-medium transition-colors font-serif text-[14px] cursor-pointer ${
                    activeTab === "logs"
                      ? "bg-black text-white"
                      : "bg-transparent text-black border border-black hover:bg-gray-50"
                  }`}
                >
                  Logs
                </button>
                <button
                  onClick={() => setActiveTab("recipients")}
                  className={`px-4 py-2 rounded-4xl font-medium transition-colors font-serif text-[14px] cursor-pointer ${
                    activeTab === "recipients"
                      ? "bg-black text-white"
                      : "bg-transparent text-black border border-black hover:bg-gray-50"
                  }`}
                >
                  Recipients
                </button>
                <button
                  onClick={() => setActiveTab("invoice")}
                  className={`px-4 py-2 rounded-4xl font-medium transition-colors font-serif text-[14px] cursor-pointer ${
                    activeTab === "invoice"
                      ? "bg-black text-white"
                      : "bg-transparent text-black border border-black hover:bg-gray-50"
                  }`}
                >
                  Invoice
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {/* Recipients Tab */}
                {activeTab === "recipients" && (
                  <div className="space-y-3">
                    {recipients.map((recipient) => {
                      // Generate signing link (same as in edit.tsx)
                      const baseUrl =
                        process.env.NEXT_PUBLIC_APP_URL ||
                        (typeof window !== "undefined"
                          ? window.location.origin
                          : "");
                      const link = `${baseUrl}/sign/${document.id}?email=${encodeURIComponent(recipient.email)}`;
                      const isAdmin =
                        currentUserId &&
                        document &&
                        currentUserId === document.admin_id;
                      return (
                        <div
                          key={recipient.id}
                          className="border border-gray-200 rounded-lg p-3"
                        >
                          <div>
                            <p className="font-medium text-sm text-gray-900">
                              {recipient.email}
                            </p>
                            {recipient.name && (
                              <p className="text-xs text-gray-600 mt-1">
                                Name:{" "}
                                <span className="font-medium">
                                  {recipient.name}
                                </span>
                              </p>
                            )}
                            {recipient.company_name && (
                              <p className="text-xs text-gray-600">
                                Company:{" "}
                                <span className="font-medium">
                                  {recipient.company_name}
                                </span>
                              </p>
                            )}
                            {recipient.position && (
                              <p className="text-xs text-gray-600">
                                Position:{" "}
                                <span className="font-medium">
                                  {recipient.position}
                                </span>
                              </p>
                            )}
                            <p className="text-xs text-gray-600 mt-1">
                              Role:{" "}
                              <span className="font-medium">
                                {recipient.role}
                              </span>
                            </p>
                            {recipient.role === "signer" && (
                              <p className="text-xs text-gray-600">
                                Status:{" "}
                                <span
                                  className={`font-medium ${
                                    recipient.status === "pending"
                                      ? "text-yellow-600"
                                      : recipient.status === "signed"
                                        ? "text-green-600"
                                        : "text-blue-600"
                                  }`}
                                >
                                  {recipient.status}
                                </span>
                              </p>
                            )}
                            {recipient.signed_at && (
                              <>
                                <p className="text-xs text-gray-600 mt-1">
                                  Signed:{" "}
                                  {new Date(
                                    recipient.signed_at,
                                  ).toLocaleString()}
                                </p>
                                {showLocation && (
                                  <>
                                    {recipient.signed_by_country &&
                                      recipient.signed_by_city && (
                                        <p className="text-xs text-gray-600">
                                          Location: {recipient.signed_by_city},{" "}
                                          {recipient.signed_by_country}
                                        </p>
                                      )}
                                    {recipient.signed_by_ip && (
                                      <p className="text-xs text-gray-600">
                                        IP: {recipient.signed_by_ip}
                                      </p>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                            {/* Show signing link and copy button if document is locked (status not draft), not completed, and user is admin */}
                            {document.status !== "draft" &&
                              document.status !== "completed" &&
                              isAdmin && (
                                <div className="mt-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-700 break-all bg-gray-50 rounded p-1 border border-gray-100">
                                      {link}
                                    </span>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(link);
                                        setToast({
                                          id: String(Date.now()),
                                          message: "Link copied to clipboard!",
                                          type: "success",
                                        });
                                      }}
                                      disabled={!hasAccess}
                                      className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 ml-1 rounded-full disabled:opacity-50 cursor-pointer transition-colors"
                                      aria-label="Copy link"
                                    >
                                      <svg
                                        className="w-4 h-4"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                      >
                                        <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1z" />
                                        <path d="M19 5H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === "invoice" && (
                  <div>
                    {attachedInvoices.length > 0 ? (
                      <div className="space-y-3">
                        {attachedInvoices.map((attachedInvoice) => {
                          const total = Number(
                            attachedInvoice.total_amount ??
                              attachedInvoice.amount ??
                              0,
                          );
                          const remaining =
                            getInvoiceRemainingAmount(attachedInvoice);
                          return (
                            <div
                              key={attachedInvoice.id}
                              className="border border-gray-200 rounded-lg p-4"
                            >
                              <div className="flex items-start justify-between mb-3 gap-2">
                                <Link href={`/invoices/${attachedInvoice.id}`}>
                                  <p className="font-medium text-sm text-gray-900 hover:underline cursor-pointer">
                                    {attachedInvoice.invoice_number ||
                                      "Attached Invoice"}
                                  </p>
                                </Link>
                                {canManageInvoices && (
                                  <button
                                    onClick={() =>
                                      handleDetachInvoice(attachedInvoice.id)
                                    }
                                    disabled={attachingInvoice || detachingInvoice}
                                    className="text-xs px-3 py-1 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Detach
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium capitalize">
                                  {String(attachedInvoice.status || "").replace(
                                    /_/g,
                                    " ",
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600">
                                Amount:{" "}
                                <span className="font-medium text-gray-800">
                                  {attachedInvoice.currency} {total.toFixed(2)}
                                </span>
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                Remaining Amount:{" "}
                                <span className="font-medium text-gray-800">
                                  {attachedInvoice.currency}{" "}
                                  {remaining.toFixed(2)}
                                </span>
                              </p>
                              {attachedInvoice.due_date && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Due Date:{" "}
                                  <span className="font-medium text-gray-800">
                                    {new Date(
                                      attachedInvoice.due_date,
                                    ).toLocaleDateString()}
                                  </span>
                                </p>
                              )}
                              <p className="text-xs text-gray-600 mt-1">
                                Created:{" "}
                                <span className="font-medium text-gray-800">
                                  {new Date(
                                    attachedInvoice.created_at,
                                  ).toLocaleDateString()}
                                </span>
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-500 mb-3">
                          No invoice attached yet.
                        </p>
                        {canManageInvoices && (
                          <button
                            onClick={openAttachInvoiceModal}
                            disabled={attachingInvoice || !hasAccess}
                            className="px-4 py-2 rounded-full text-sm font-medium text-white bg-black hover:bg-gray-800 disabled:opacity-50"
                          >
                            Attach Invoice
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Conversation Tab */}
                {activeTab === "conversation" && (
                  <div style={{ height: "500px" }}>
                    <ChatPanel
                      documentId={String(id)}
                      userEmail={currentUserEmail}
                      userName={currentUserName}
                      isAdmin={currentUserId === document.admin_id}
                      isDisabled={!hasAccess}
                      recipients={recipients}
                    />
                  </div>
                )}

                {/* Logs Tab */}
                {activeTab === "logs" && (
                  <div className="space-y-3">
                    {auditLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">No activity yet</p>
                    ) : (
                      aggregatedAuditLogs.map((entry) => (
                        <div
                          key={`${entry.log.id}-${entry.type}`}
                          className="text-sm border-l-2 border-gray-300 pl-3 py-2 mb-3 bg-gray-50 p-3 rounded"
                        >
                          <p className="font-medium text-gray-900">
                            {entry.type === "open"
                              ? "DOCUMENT_OPENED"
                              : entry.log.action}
                          </p>
                          <p className="text-xs text-gray-700 mt-1">
                            <span className="font-medium">Email:</span>{" "}
                            {entry.log.actor_email}
                          </p>
                          {entry.type === "open" && (
                            <p className="text-xs text-gray-700 mt-1">
                              Opened {entry.count} times
                            </p>
                          )}
                          {entry.log.details?.recipient_name && (
                            <p className="text-xs text-gray-700">
                              <span className="font-medium">Name:</span>{" "}
                              {entry.log.details.recipient_name}
                            </p>
                          )}
                          {entry.log.details?.recipient_company && (
                            <p className="text-xs text-gray-700">
                              <span className="font-medium">Company:</span>{" "}
                              {entry.log.details.recipient_company}
                            </p>
                          )}
                          {showLocation && (
                            <>
                              {entry.log.details?.location && (
                                <p className="text-xs text-gray-700">
                                  <span className="font-medium">Location:</span>{" "}
                                  {entry.log.details.location}
                                </p>
                              )}
                              {entry.log.details?.city &&
                                entry.log.details?.country && (
                                  <p className="text-xs text-gray-700">
                                    <span className="font-medium">
                                      Location:
                                    </span>{" "}
                                    {entry.log.details.city},{" "}
                                    {entry.log.details.country}
                                  </p>
                                )}
                              {entry.log.ip_address && (
                                <p className="text-xs text-gray-700">
                                  <span className="font-medium">IP:</span>{" "}
                                  {entry.log.ip_address}
                                </p>
                              )}
                            </>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {entry.type === "open"
                              ? `Last opened: ${formatTimeAgo(entry.log.timestamp)}`
                              : formatTimeAgo(entry.log.timestamp)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Attach Invoice Modal */}
      {showAttachInvoiceModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Attach Invoice
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Select one or more existing invoices to attach with this document.
            </p>
            <div className="space-y-3 max-h-72 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {loadingInvoices ? (
                <p className="text-sm text-gray-500">Loading invoices...</p>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-gray-500">No invoices found.</p>
              ) : (
                invoices.map((invoice) => (
                  <label
                    key={invoice.id}
                    className="flex items-center justify-between border border-gray-200 rounded-lg p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {invoice.invoice_number || "Invoice"}
                      </p>
                      <p className="text-xs text-gray-600">
                        {invoice.client_name} - {invoice.currency}{" "}
                        {Number(
                          invoice.total_amount ?? invoice.amount ?? 0,
                        ).toFixed(2)}
                      </p>
                      {attachedInvoiceIds.includes(invoice.id) && (
                        <p className="text-xs text-green-700 mt-1">
                          Already attached
                        </p>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      disabled={attachedInvoiceIds.includes(invoice.id)}
                      checked={selectedInvoiceIds.includes(invoice.id)}
                      onChange={(e) =>
                        setSelectedInvoiceIds((prev) =>
                          e.target.checked
                            ? [...prev, invoice.id]
                            : prev.filter((item) => item !== invoice.id),
                        )
                      }
                    />
                  </label>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowAttachInvoiceModal(false)}
                disabled={attachingInvoice}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAttachInvoice}
                disabled={attachingInvoice || selectedInvoiceIds.length === 0}
                className="flex-1 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-50"
              >
                {attachingInvoice ? "Saving..." : "Attach"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detach Invoice Confirmation Modal */}
      {showDetachInvoiceModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h14a4 4 0 110 8H9m0 0l4-4m-4 4l4 4"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">
                Detach Invoice?
              </h3>
              <p className="text-gray-600">
                This will remove invoice from this document and add a
                conversation entry.
              </p>
              <div className="w-full text-left">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detach reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={detachInvoiceReason}
                  onChange={(e) => setDetachInvoiceReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why this invoice is being detached..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent text-black"
                  disabled={detachingInvoice}
                />
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => setShowDetachInvoiceModal(false)}
                  disabled={detachingInvoice}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDetachInvoice}
                  disabled={detachingInvoice || !detachInvoiceReason.trim()}
                  className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {detachingInvoice ? "Detaching..." : "Detach"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Signing Links
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Copy and share these links with recipients.
            </p>
            <div className="space-y-4 max-h-72 overflow-y-auto">
              {recipients.map((recipient) => (
                <div
                  key={recipient.id}
                  className="border border-gray-200 rounded p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">
                      {recipient.email}
                    </span>
                    <button
                      onClick={() => {
                        const baseUrl =
                          process.env.NEXT_PUBLIC_APP_URL ||
                          (typeof window !== "undefined"
                            ? window.location.origin
                            : "");
                        const link = `${baseUrl}/sign/${id}?email=${encodeURIComponent(recipient.email)}`;
                        navigator.clipboard.writeText(link);
                        setToast({
                          id: String(Date.now()),
                          message: "Link copied to clipboard!",
                          type: "success",
                        });
                      }}
                      className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowLinkModal(false)}
              className="w-full mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
