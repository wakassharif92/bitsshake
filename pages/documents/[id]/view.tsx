import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Document, Recipient, AuditLog } from "@/lib/types";

export default function ViewDocument() {
  const router = useRouter();
  const { id } = router.query;
  const [document, setDocument] = useState<Document | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
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
    // Check if all recipients have signed
    const allSigned = recipients.every((r) => r.status === "signed");

    if (!allSigned) {
      const unsigned = recipients.filter((r) => r.status !== "signed");
      alert(
        `Document cannot be downloaded until all recipients have signed.\n\nPending signatures from:\n${unsigned.map((r) => r.email).join("\n")}`,
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
            <button
              onClick={handleDownloadPDF}
              disabled={!recipients.every((r) => r.status === "signed")}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              title={
                recipients.every((r) => r.status === "signed")
                  ? "Download signed document"
                  : "All recipients must sign before download"
              }
            >
              Download PDF
            </button>
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
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Recipients
              </h2>
              <div className="space-y-3">
                {recipients.map((recipient) => (
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
                          <span className="font-medium">{recipient.name}</span>
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
                    </div>
                  </div>
                ))}
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
