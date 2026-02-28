import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Document, Invoice, Recipient, User } from "@/lib/types";
import { hasPremiumAccess } from "@/lib/subscription";
import ChatPanel from "@/components/ChatPanel";

const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
});

export default function EditDocument() {
  const router = useRouter();
  const { id } = router.query;
  const [document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [sendingDocument, setSendingDocument] = useState(false);
  const [showSendPopover, setShowSendPopover] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<{
    [recipientId: string]: string;
  }>({});
  const [lockingDocument, setLockingDocument] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "conversation" | "recipients" | "invoice"
  >("conversation");
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [showSendLinkModal, setShowSendLinkModal] = useState(false);
  const [showAttachInvoiceModal, setShowAttachInvoiceModal] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [attachingInvoice, setAttachingInvoice] = useState(false);
  const [attachedInvoiceIds, setAttachedInvoiceIds] = useState<string[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [showDetachInvoiceModal, setShowDetachInvoiceModal] = useState(false);
  const [detachingInvoice, setDetachingInvoice] = useState(false);
  const [detachInvoiceReason, setDetachInvoiceReason] = useState("");
  const [invoiceToDetach, setInvoiceToDetach] = useState<Invoice | null>(null);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertReason, setRevertReason] = useState("");
  const [revertingDocument, setRevertingDocument] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newRecipient, setNewRecipient] = useState({
    email: "",
    name: "",
    company_name: "",
    position: "",
    role: "signer" as "signer" | "viewer",
  });

  const openAlertModal = useCallback((message: string, title = "Notice") => {
    setAlertModal({ title, message });
  }, []);

  const loadInvoices = useCallback(async (adminId: string) => {
    setLoadingInvoices(true);
    try {
      const { data: invoiceData, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("admin_id", adminId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices((invoiceData || []) as Invoice[]);
    } catch (err: any) {
      openAlertModal("Error loading invoices: " + err.message, "Error");
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [openAlertModal]);

  const loadAttachedInvoices = useCallback(
    async (documentId: string) => {
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
        openAlertModal("Error loading attached invoices: " + err.message, "Error");
        setAttachedInvoiceIds([]);
      }
    },
    [openAlertModal],
  );

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      // Store current user info
      setCurrentUserEmail(session.user.email || "");
      setCurrentUserName(
        session.user.user_metadata?.full_name || session.user.email || "",
      );

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      setCurrentUser(userData || null);
      await loadInvoices(session.user.id);

      // Fetch document
      const { data: docData } = await supabase
        .from("documents")
        .select("*")
        .eq("id", id)
        .eq("admin_id", session.user.id)
        .single();

      if (!docData) {
        router.push("/dashboard");
        return;
      }

      setDocument(docData);
      setTitle(docData.title);
      setContent(docData.content || "");
      await loadAttachedInvoices(String(id));

      // Fetch recipients
      const { data: recipientsData } = await supabase
        .from("recipients")
        .select("*")
        .eq("document_id", id)
        .order("created_at", { ascending: false });

      setRecipients(recipientsData || []);
      setLoading(false);
    };

    fetchData();
  }, [id, loadAttachedInvoices, loadInvoices, router]);

  const handleAttachInvoice = async () => {
    if (!id || !document) return;
    if (!hasPremiumAccess(currentUser)) {
      openAlertModal(
        "Your subscription is inactive. Please upgrade to continue.",
        "Subscription inactive",
      );
      return;
    }

    setAttachingInvoice(true);
    try {
      if (selectedInvoiceIds.length === 0) {
        openAlertModal("Please select at least one invoice.", "No invoice selected");
        return;
      }

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
      openAlertModal("Invoice(s) attached successfully.", "Success");
    } catch (err: any) {
      const message = String(err?.message || "Unknown error");
      if (
        message.includes(
          "Could not find the table 'public.document_invoices' in the schema cache",
        )
      ) {
        openAlertModal(
          "Database is missing document_invoices table in API cache.\n\nRun this SQL in Supabase SQL Editor:\nCREATE TABLE IF NOT EXISTS document_invoices (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,\n  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,\n  created_at timestamp DEFAULT now(),\n  UNIQUE(document_id, invoice_id)\n);\nNOTIFY pgrst, 'reload schema';\n\nThen try attaching again.",
          "Schema update required",
        );
        return;
      }
      openAlertModal("Error attaching invoice: " + message, "Error");
    } finally {
      setAttachingInvoice(false);
    }
  };

  const openAttachInvoiceModal = async () => {
    if (!currentUser?.id || !document) return;
    setSelectedInvoiceIds([]);
    await loadInvoices(currentUser.id);
    setShowAttachInvoiceModal(true);
  };

  const handleDetachInvoice = async (invoiceId: string) => {
    const target = attachedInvoices.find((item) => item.id === invoiceId) || null;
    setInvoiceToDetach(target);
    setDetachInvoiceReason("");
    setShowDetachInvoiceModal(true);
  };

  const confirmDetachInvoice = async () => {
    if (!id) return;
    if (!invoiceToDetach) return;
    const reason = detachInvoiceReason.trim();
    if (!reason) {
      openAlertModal("Please provide a detach reason.", "Reason required");
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
      openAlertModal("Invoice detached successfully.", "Success");
    } catch (err: any) {
      openAlertModal("Error detaching invoice: " + err.message, "Error");
    } finally {
      setDetachingInvoice(false);
    }
  };

  const handleSaveDocument = async () => {
    if (!id || !document) return;
    if (!hasPremiumAccess(currentUser)) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from("documents")
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq("id", id);

      setDocument({ ...document, title, content });
      setShowSavedModal(true);
      setTimeout(() => setShowSavedModal(false), 2000);
    } catch (err: any) {
      openAlertModal("Error saving document: " + err.message, "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecipient = async () => {
    if (!hasPremiumAccess(currentUser)) {
      openAlertModal(
        "Your subscription is inactive. Please upgrade to continue.",
        "Subscription inactive",
      );
      return;
    }
    if (!newRecipient.email.trim() || !newRecipient.name.trim() || !id) {
      openAlertModal(
        "Please fill in all required fields (Email and Name)",
        "Missing information",
      );
      return;
    }

    setAddingRecipient(true);
    try {
      const { data: insertedData, error } = await supabase
        .from("recipients")
        .insert([
          {
            document_id: id,
            email: newRecipient.email.toLowerCase(),
            name: newRecipient.name,
            company_name: newRecipient.company_name,
            position: newRecipient.position,
            role: newRecipient.role,
            status: "pending",
          },
        ])
        .select();

      if (error) throw error;

      // Use the actual inserted recipient data from the response
      const insertedRecipient = insertedData?.[0];
      if (insertedRecipient) {
        setRecipients([...recipients, insertedRecipient]);
      }

      setNewRecipient({
        email: "",
        name: "",
        company_name: "",
        position: "",
        role: "signer",
      });
      setShowModal(false);
    } catch (err: any) {
      openAlertModal("Error adding recipient: " + err.message, "Error");
    } finally {
      setAddingRecipient(false);
    }
  };

  const handleRemoveRecipient = async (recipientId: string) => {
    if (!hasPremiumAccess(currentUser)) {
      openAlertModal(
        "Your subscription is inactive. Please upgrade to continue.",
        "Subscription inactive",
      );
      return;
    }
    if (!confirm("Remove this recipient?")) return;

    try {
      await supabase.from("recipients").delete().eq("id", recipientId);

      setRecipients(recipients.filter((r) => r.id !== recipientId));
    } catch (err: any) {
      openAlertModal("Error removing recipient: " + err.message, "Error");
    }
  };

  // Send via Email (current behavior)
  const handleSendViaEmail = async () => {
    if (!hasPremiumAccess(currentUser)) {
      openAlertModal(
        "Your subscription is inactive. Please upgrade to continue.",
        "Subscription inactive",
      );
      return;
    }
    if (!document || (document.status !== "draft" && document.status !== "revert")) {
      openAlertModal(
        "Document must be in draft or revert status before sending.",
        "Invalid status",
      );
      return;
    }
    if (!id || recipients.length === 0) {
      openAlertModal(
        "Please add at least one recipient before sending",
        "Recipients required",
      );
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
        openAlertModal(`Error sending emails: ${data.error}`, "Error");
        return;
      }

      openAlertModal(data.message || "Document sent to recipients!", "Success");
      router.push("/dashboard");
    } catch (err: any) {
      openAlertModal("Error sending document: " + err.message, "Error");
    } finally {
      setSendingDocument(false);
    }
  };

  // Send Link: lock document and show modal for link generation
  const handleSendViaLink = async () => {
    if (!hasPremiumAccess(currentUser)) {
      openAlertModal(
        "Your subscription is inactive. Please upgrade to continue.",
        "Subscription inactive",
      );
      return;
    }
    if (!document || (document.status !== "draft" && document.status !== "revert")) {
      openAlertModal(
        "Document must be in draft or revert status before sending.",
        "Invalid status",
      );
      return;
    }
    if (!id || recipients.length === 0) {
      openAlertModal(
        "Please add at least one recipient before sending",
        "Recipients required",
      );
      setShowSendPopover(false);
      return;
    }
    setShowSendLinkModal(true);
  };

  const confirmSendViaLink = async () => {
    setShowSendLinkModal(false);
    setLockingDocument(true);
    try {
      await supabase.from("documents").update({ status: "sent" }).eq("id", id);
      setDocument((prev) => (prev ? { ...prev, status: "sent" } : prev)); // update local state immediately
      // Pre-populate all links for recipients
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const links: { [recipientId: string]: string } = {};
      recipients.forEach((recipient) => {
        links[recipient.id] =
          `${baseUrl}/sign/${id}?email=${encodeURIComponent(recipient.email)}`;
      });
      setGeneratedLinks(links);
      setShowLinkModal(true);
      setShowSendPopover(false);
    } catch (err: any) {
      openAlertModal("Error locking document: " + err.message, "Error");
    } finally {
      setLockingDocument(false);
    }
  };

  const handleOpenRevertModal = () => {
    if (!document || document.status !== "sent") return;
    setRevertReason("");
    setShowRevertModal(true);
  };

  const confirmRevertDocument = async () => {
    if (!id || !document) return;
    const isDocumentAdmin = currentUser?.id === document.admin_id;
    if (!isDocumentAdmin) {
      openAlertModal("Only the document admin can revert this document.", "Unauthorized");
      return;
    }

    const reason = revertReason.trim();
    if (!reason) {
      openAlertModal("Please provide a revert reason.", "Reason required");
      return;
    }

    setRevertingDocument(true);
    try {
      const { error: updateError } = await supabase
        .from("documents")
        .update({
          status: "revert",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      setDocument((prev) => (prev ? { ...prev, status: "revert" } : prev));

      const chatResponse = await fetch("/api/chat-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: String(id),
          message: `[REVERT] ${reason}`,
          senderEmail: currentUserEmail,
          senderName: currentUserName || "Admin",
        }),
      });

      if (!chatResponse.ok) {
        const chatData = await chatResponse.json().catch(() => null);
        throw new Error(
          chatData?.error || "Failed to add revert reason in conversation",
        );
      }

      await supabase.from("audit_logs").insert([
        {
          document_id: String(id),
          action: "DOCUMENT_REVERTED",
          actor_email: currentUserEmail || "admin",
          details: {
            reason,
          },
        },
      ]);

      setShowRevertModal(false);
      setRevertReason("");
      openAlertModal(
        "Document reverted successfully. You can now edit and resend it.",
        "Reverted",
      );
    } catch (err: any) {
      openAlertModal("Error reverting document: " + err.message, "Error");
    } finally {
      setRevertingDocument(false);
    }
  };

  // Generate link for a recipient (after document is locked)
  const handleGenerateLink = (recipient: Recipient) => {
    if (!hasPremiumAccess(currentUser)) {
      openAlertModal(
        "Your subscription is inactive. Please upgrade to continue.",
        "Subscription inactive",
      );
      return;
    }
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const link = `${baseUrl}/sign/${id}?email=${encodeURIComponent(recipient.email)}`;
    setGeneratedLinks((prev) => ({ ...prev, [recipient.id]: link }));
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

  const isLocked = !hasPremiumAccess(currentUser);
  const isEditableStatus =
    document.status === "draft" || document.status === "revert";
  const isDocumentAdmin = currentUser?.id === document.admin_id;
  const attachedInvoices = attachedInvoiceIds
    .map((invoiceId) => invoices.find((invoice) => invoice.id === invoiceId))
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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Success Modal */}
      {showSavedModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">
                Document Saved!
              </h3>
              <p className="text-gray-600">
                Your document has been successfully saved.
              </p>
            </div>
          </div>
        </div>
      )}

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
                  className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {sendingDocument ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Link Confirmation Modal */}
      {showSendLinkModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-amber-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">
                Lock Document?
              </h3>
              <p className="text-gray-600">
                Once you generate links, this document will be locked and
                cannot be edited. Continue?
              </p>
              <div className="flex gap-3 w-full mt-6">
                <button
                  onClick={() => setShowSendLinkModal(false)}
                  disabled={lockingDocument}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSendViaLink}
                  disabled={lockingDocument}
                  className="flex-1 px-6 py-3 rounded-xl bg-black text-white font-medium hover:bg-black/90 transition-colors disabled:opacity-50"
                >
                  {lockingDocument ? "Locking..." : "Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                        <p className="text-xs text-green-700 mt-1">Already attached</p>
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
                This will remove invoice from this document and add a conversation entry.
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

      {/* Revert Confirmation Modal */}
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

      {alertModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 bg-black/10 rounded-full flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">
                {alertModal.title}
              </h3>
              <p className="text-gray-600">{alertModal.message}</p>
              <div className="w-full mt-6">
                <button
                  onClick={() => setAlertModal(null)}
                  className="w-full px-6 py-3 rounded-xl bg-black text-white font-medium hover:bg-black/90 transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-12">
              <Link href="/dashboard">
                <button className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-black/80 transition-colors">
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
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Edit Document
                </h1>
                <div className="mt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full border border-red-600 text-red-600 text-xs font-semibold uppercase tracking-wide">
                    {document.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {document.status === "sent" && isDocumentAdmin && (
                <button
                  onClick={handleOpenRevertModal}
                  disabled={revertingDocument || isLocked}
                  className="px-8 py-2.5 rounded-full text-[15px] font-medium text-white bg-red-600 hover:bg-red-700 transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {revertingDocument ? "Reverting..." : "Revert"}
                </button>
              )}
              <button
                onClick={openAttachInvoiceModal}
                disabled={isLocked || attachingInvoice || !currentUser?.id}
                className="px-6 py-2.5 rounded-full text-[14px] font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                {attachingInvoice ? "Attaching..." : "Attach Invoice"}
              </button>
              <button
                onClick={handleSaveDocument}
                disabled={saving || isLocked}
                className="px-8 py-2.5 rounded-full text-[15px] font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                {saving ? "Saving..." : "Save Document"}
              </button>
              <div className="relative">
                <button
                  ref={sendButtonRef}
                  onClick={() => setShowSendPopover((v) => !v)}
                  disabled={sendingDocument || isLocked}
                  className="px-8 py-2.5 rounded-full text-[15px] font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {sendingDocument ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full"></div>
                      Sending...
                    </>
                  ) : (
                    "Send to Recipients"
                  )}
                </button>
                {showSendPopover && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-black rounded-xl shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        setShowSendPopover(false);
                        handleSendViaEmail();
                      }}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-100"
                      disabled={
                        sendingDocument ||
                        !isEditableStatus ||
                        isLocked
                      }
                    >
                      Send via Email
                    </button>
                    <div className="border-t border-black/10" />
                    <button
                      onClick={() => {
                        setShowSendPopover(false);
                        if (isEditableStatus) {
                          handleSendViaLink();
                        } else {
                          // Pre-populate all links for recipients if not already
                          if (
                            Object.keys(generatedLinks).length !==
                            recipients.length
                          ) {
                            const baseUrl =
                              process.env.NEXT_PUBLIC_APP_URL ||
                              (typeof window !== "undefined"
                                ? window.location.origin
                                : "");
                            const links: { [recipientId: string]: string } = {};
                            recipients.forEach((recipient) => {
                              links[recipient.id] =
                                `${baseUrl}/sign/${id}?email=${encodeURIComponent(recipient.email)}`;
                            });
                            setGeneratedLinks(links);
                          }
                          setShowLinkModal(true);
                        }
                      }}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-100"
                      disabled={sendingDocument || isLocked}
                    >
                      {isEditableStatus ? "Send Link" : "View Links"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 lg:px-8 py-4">
          {isLocked && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your trial has ended. Upgrade to edit documents, manage
              recipients, send for signature, or use chat.
              <Link href="/pricing" className="ml-2 font-semibold underline">
                View pricing
              </Link>
            </div>
          )}
          {/* Title input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              disabled={!isEditableStatus || isLocked}
            />
          </div>

          {/* Document content */}
          {document.is_uploaded ? (
            <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-lg border border-gray-300">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Uploaded PDF
                  </h3>
                  <p className="text-sm text-gray-600">
                    Manage recipients on the right.
                  </p>
                </div>
                {document.file_url && (
                  <a
                    href={document.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                  >
                    Open in New Tab
                  </a>
                )}
              </div>
              {document.file_url ? (
                <iframe
                  title="Uploaded PDF"
                  src={document.file_url}
                  className="flex-1 w-full"
                />
              ) : (
                <div className="p-6">
                  <p className="text-sm text-red-600">
                    PDF file link not available.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-lg border border-gray-300">
              <RichEditor
                content={content}
                onChange={setContent}
                readOnly={!isEditableStatus || isLocked}
              />
            </div>
          )}
        </div>

        {/* Right sidebar tabs */}
        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 border-b border-gray-200 flex gap-2">
            <button
              onClick={() => setActiveSidebarTab("conversation")}
              className={`px-4 py-2 rounded-4xl font-medium transition-colors text-[13px] font-serif cursor-pointer ${
                activeSidebarTab === "conversation"
                  ? "bg-black text-white"
                  : "bg-transparent text-black border border-black hover:bg-gray-50"
              }`}
            >
              Conversation
            </button>
            <button
              onClick={() => setActiveSidebarTab("recipients")}
              className={`px-4 py-2 rounded-4xl font-medium transition-colors text-[13px] font-serif cursor-pointer ${
                activeSidebarTab === "recipients"
                  ? "bg-black text-white"
                  : "bg-transparent text-black border border-black hover:bg-gray-50"
              }`}
            >
              Recipients
            </button>
            <button
              onClick={() => setActiveSidebarTab("invoice")}
              className={`px-4 py-2 rounded-4xl font-medium transition-colors text-[13px] font-serif cursor-pointer ${
                activeSidebarTab === "invoice"
                  ? "bg-black text-white"
                  : "bg-transparent text-black border border-black hover:bg-gray-50"
              }`}
            >
              Invoice
            </button>
          </div>

          {activeSidebarTab === "conversation" && (
            <div className="p-2">
              <ChatPanel
                documentId={String(id)}
                userEmail={currentUserEmail}
                userName={currentUserName}
                isAdmin={true}
                isDisabled={isLocked}
                recipients={recipients}
              />
            </div>
          )}

          {activeSidebarTab === "recipients" && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Recipients
                </h2>
                {isEditableStatus && (
                  <button
                    onClick={() => setShowModal(true)}
                    disabled={!isEditableStatus || isLocked}
                    className="px-6 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    + Add
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {recipients.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No recipients added yet
                  </p>
                ) : (
                  recipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm text-gray-900">
                            {recipient.email}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Full name:{" "}
                            <span className="font-medium text-gray-800">
                              {recipient.name || "Not provided"}
                            </span>
                          </p>
                          <p className="text-xs text-gray-600">
                            Company:{" "}
                            <span className="font-medium text-gray-800">
                              {recipient.company_name || "Not provided"}
                            </span>
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Role:{" "}
                            <span className="font-medium">
                              {recipient.role}
                            </span>
                          </p>
                          {recipient.position && (
                            <p className="text-xs text-gray-600">
                              Position:{" "}
                              <span className="font-medium">
                                {recipient.position}
                              </span>
                            </p>
                          )}
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
                          {recipient.signed_at && (
                            <p className="text-xs text-gray-600 mt-1">
                              Signed:{" "}
                              {new Date(recipient.signed_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        {isEditableStatus && (
                          <button
                            onClick={() => handleRemoveRecipient(recipient.id)}
                            disabled={isLocked}
                            className="text-red-600 hover:text-red-800 text-xs disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeSidebarTab === "invoice" && (
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Invoice</h2>
              {attachedInvoices.length > 0 ? (
                <div className="space-y-3">
                  {attachedInvoices.map((attachedInvoice) => {
                    const total = Number(
                      attachedInvoice.total_amount ?? attachedInvoice.amount ?? 0,
                    );
                    const remaining = getInvoiceRemainingAmount(attachedInvoice);
                    return (
                      <div
                        key={attachedInvoice.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <Link href={`/invoices/${attachedInvoice.id}`}>
                            <p className="font-medium text-sm text-gray-900 hover:underline cursor-pointer">
                              {attachedInvoice.invoice_number || "Attached Invoice"}
                            </p>
                          </Link>
                          <button
                            onClick={() => handleDetachInvoice(attachedInvoice.id)}
                            disabled={attachingInvoice || detachingInvoice}
                            className="text-xs px-3 py-1 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Detach
                          </button>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium capitalize">
                            {String(attachedInvoice.status || "").replace(/_/g, " ")}
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
                            {attachedInvoice.currency} {remaining.toFixed(2)}
                          </span>
                        </p>
                        {attachedInvoice.due_date && (
                          <p className="text-xs text-gray-600 mt-1">
                            Due Date:{" "}
                            <span className="font-medium text-gray-800">
                              {new Date(attachedInvoice.due_date).toLocaleDateString()}
                            </span>
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          Created:{" "}
                          <span className="font-medium text-gray-800">
                            {new Date(attachedInvoice.created_at).toLocaleDateString()}
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
                  <button
                    onClick={openAttachInvoiceModal}
                    disabled={isLocked || attachingInvoice || !currentUser?.id}
                    className="px-4 py-2 rounded-full text-sm font-medium text-white bg-black hover:bg-gray-800 disabled:opacity-50"
                  >
                    Attach Invoice
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Send Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {document?.status === "draft"
                ? "Generate Signing Links"
                : "Signing Links"}
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Links are unique for each recipient.{" "}
              {document?.status === "draft"
                ? "Once generated, you can copy and share them manually."
                : "Copy and share them manually."}
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
                    {document?.status === "draft" ? (
                      !generatedLinks[recipient.id] ? (
                        <button
                          onClick={() => handleGenerateLink(recipient)}
                          className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                        >
                          Generate Link
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              generatedLinks[recipient.id],
                            );
                            openAlertModal("Link copied to clipboard!", "Copied");
                          }}
                          className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                        >
                          Copy Link
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            generatedLinks[recipient.id],
                          );
                          openAlertModal("Link copied to clipboard!", "Copied");
                        }}
                        className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                      >
                        Copy Link
                      </button>
                    )}
                  </div>
                  {((document?.status === "draft" &&
                    generatedLinks[recipient.id]) ||
                    document?.status !== "draft") && (
                    <div className="break-all text-xs text-gray-700 bg-gray-50 rounded p-2 border border-gray-100 mt-1">
                      {generatedLinks[recipient.id]}
                    </div>
                  )}
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
      {showModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4 font-serif">
              Add Recipient
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newRecipient.email}
                  onChange={(e) =>
                    setNewRecipient({ ...newRecipient, email: e.target.value })
                  }
                  placeholder="recipient@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-black focus:border-transparent text-black bg-white/80 font-serif"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRecipient.name}
                  onChange={(e) =>
                    setNewRecipient({ ...newRecipient, name: e.target.value })
                  }
                  placeholder="Full Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-black focus:border-transparent text-black bg-white/80 font-serif"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newRecipient.company_name}
                  onChange={(e) =>
                    setNewRecipient({
                      ...newRecipient,
                      company_name: e.target.value,
                    })
                  }
                  placeholder="Company Name (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-black focus:border-transparent text-black bg-white/80 font-serif"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                  Position
                </label>
                <input
                  type="text"
                  value={newRecipient.position}
                  onChange={(e) =>
                    setNewRecipient({
                      ...newRecipient,
                      position: e.target.value,
                    })
                  }
                  placeholder="Position (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-black focus:border-transparent text-black bg-white/80 font-serif"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                  Role
                </label>
                <select
                  value={newRecipient.role}
                  onChange={(e) =>
                    setNewRecipient({
                      ...newRecipient,
                      role: e.target.value as "signer" | "viewer",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-black focus:border-transparent bg-white/80 font-serif"
                >
                  <option className="font-serif" value="signer">
                    Signer
                  </option>
                  <option className="font-serif" value="viewer">
                    Viewer
                  </option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleAddRecipient}
                  disabled={
                    !newRecipient.email.trim() ||
                    !newRecipient.name.trim() ||
                    addingRecipient
                  }
                  className="flex-1 px-4 py-2 bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] text-white rounded-full font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {addingRecipient ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full font-serif"></div>
                      Adding...
                    </>
                  ) : (
                    "Add Recipient"
                  )}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={addingRecipient}
                  className="flex-1 px-4 py-2 bg-white text-black border-2 border-black rounded-full font-medium hover:bg-gray-100 disabled:opacity-50 font-serif"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
