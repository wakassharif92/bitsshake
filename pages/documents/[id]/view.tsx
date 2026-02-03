// (Removed duplicate ViewDocument function. The main implementation follows below.)
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Document, Recipient, AuditLog } from "@/lib/types";

export default function ViewDocument() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showSendPopover, setShowSendPopover] = useState(false);
  const [sendingDocument, setSendingDocument] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  // Send via Email (same as edit page)
  const handleSendViaEmail = async () => {
    if (!id || recipients.length === 0) {
      alert("Please add at least one recipient before sending");
      return;
    }

    if (
      !confirm(
        "Send this document to all recipients? They will receive signing links via email.",
      )
    ) {
      return;
    }

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
    setShowLinkModal(true);
  };
  const router = useRouter();
  const { id } = router.query;
  const [document, setDocument] = useState<Document | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      // Get current user
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id || null);

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
    };

    fetchData();
  }, [id, router]);

  const handleDownloadPDF = async () => {
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

    alert("PDF download feature coming soon!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!document) {
    return <div>Document not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <button className="text-gray-600 hover:text-gray-900">
                  ← Back
                </button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {document.title}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Status: {document.status}
                </p>
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
                    disabled={!allSignersSigned}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    title={
                      allSignersSigned
                        ? "Download signed document"
                        : "All signers must sign before download"
                    }
                  >
                    Download PDF
                  </button>
                );
              })()}
              {/* Show Send to Recipients button for admin only, and only if not completed */}
              {currentUserId &&
                document &&
                currentUserId === document.admin_id &&
                document.status !== "completed" && (
                  <div className="relative">
                    <button
                      onClick={() => setShowSendPopover((v) => !v)}
                      disabled={sendingDocument}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {sendingDocument ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Sending...
                        </>
                      ) : (
                        "Send Again"
                      )}
                    </button>
                    {showSendPopover && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg z-50">
                        <button
                          onClick={() => {
                            setShowSendPopover(false);
                            handleSendViaEmail();
                          }}
                          className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                          disabled={sendingDocument}
                        >
                          Send via Email
                        </button>
                        <button
                          onClick={() => {
                            setShowSendPopover(false);
                            handleSendViaLink();
                          }}
                          className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                          disabled={sendingDocument}
                        >
                          View Links
                        </button>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">
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
            </div>
          </div>

          {/* Details panel */}
          <div className="space-y-6">
            {/* Recipients */}
            <div className="bg-white shadow rounded-lg p-6">
              {/* <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Recipients
                </h2>
                {currentUserId &&
                  document &&
                  currentUserId === document.admin_id && (
                    <button
                      onClick={() =>
                        alert(
                          'To send emails, please use the "Send to Recipients" button in the Edit Document page.',
                        )
                      }
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Send to Recipients
                    </button>
                  )}
              </div> */}
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
                        <p className="text-xs text-gray-600 mt-1">
                          Role:{" "}
                          <span className="font-medium">{recipient.role}</span>
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
                              {new Date(recipient.signed_at).toLocaleString()}
                            </p>
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
                                    alert("Link copied to clipboard!");
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-xs border border-blue-200 rounded px-2 py-1 ml-1"
                                >
                                  Copy Link
                                </button>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audit Log */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Activity Log
              </h2>
              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-gray-500">No activity yet</p>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="text-sm border-l-2 border-gray-300 pl-3 py-2 mb-3 bg-gray-50 p-3 rounded"
                    >
                      <p className="font-medium text-gray-900">{log.action}</p>
                      <p className="text-xs text-gray-700 mt-1">
                        <span className="font-medium">Email:</span>{" "}
                        {log.actor_email}
                      </p>
                      {log.details?.recipient_name && (
                        <p className="text-xs text-gray-700">
                          <span className="font-medium">Name:</span>{" "}
                          {log.details.recipient_name}
                        </p>
                      )}
                      {log.details?.recipient_company && (
                        <p className="text-xs text-gray-700">
                          <span className="font-medium">Company:</span>{" "}
                          {log.details.recipient_company}
                        </p>
                      )}
                      {log.details?.city && log.details?.country && (
                        <p className="text-xs text-gray-700">
                          <span className="font-medium">Location:</span>{" "}
                          {log.details.city}, {log.details.country}
                        </p>
                      )}
                      {log.ip_address && (
                        <p className="text-xs text-gray-700">
                          <span className="font-medium">IP:</span>{" "}
                          {log.ip_address}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
