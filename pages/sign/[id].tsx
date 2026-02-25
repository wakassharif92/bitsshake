import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ChatMessage, Document, Recipient } from "@/lib/types";
import Image from "next/image";
import ChatPanel from "@/components/ChatPanel";
import Toast, { ToastMessage } from "@/components/Toast";

export default function SignDocument() {
  const [geoDebug, setGeoDebug] = useState<string | null>(null);
  const router = useRouter();
  const { id, email } = router.query;
  const [document, setDocument] = useState<Document | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signatureType, setSignatureType] = useState<"typed" | "draw">("typed");
  const [signatureText, setSignatureText] = useState("");
  const [signatureFont, setSignatureFont] = useState("cursive");
  const [userName, setUserName] = useState("");
  const [chatSignatures, setChatSignatures] = useState<ChatMessage[]>([]);
  const hasLoggedOpenRef = useRef(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertReason, setRevertReason] = useState("");
  const [revertingDocument, setRevertingDocument] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fonts = [
    { name: "Cursive", value: "cursive" },
    { name: "Script", value: "script" },
    { name: "Formal", value: "formal" },
  ];

  useEffect(() => {
    if (!router.isReady) return;
    if (!id || !email) {
      setLoading(false);
      return;
    }

    const linkEmailRaw = Array.isArray(email) ? email[0] : email;
    const linkEmail = linkEmailRaw ? decodeURIComponent(linkEmailRaw) : "";
    const normalizedEmail = linkEmail.trim().toLowerCase();

    const fetchData = async () => {
      setLoading(true);
      const logDocumentOpened = async (actorEmail: string) => {
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

          const logResponse = await fetch("/api/log-document-open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentId: String(id),
              actorEmail,
              ip,
              userAgent: navigator.userAgent,
              location: locationLabel,
              source: "sign_link",
              clientTime: new Date().toLocaleString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
          });

          if (!logResponse.ok) {
            const logData = await logResponse.json();
            throw new Error(logData?.error || "Failed to log document open");
          }

          hasLoggedOpenRef.current = true;
        } catch (err) {
          console.error("Error logging document open:", err);
        }
      };

      try {
        // Fetch public document + recipients via API (bypasses recipient RLS).
        const publicResponse = await fetch(
          `/api/public-document?documentId=${encodeURIComponent(
            String(id),
          )}&email=${encodeURIComponent(linkEmail)}`,
        );

        if (!publicResponse.ok) {
          return;
        }

        const publicData = await publicResponse.json();
        const docData: Document | null = publicData.document || null;
        const recipientsData: Recipient[] = publicData.recipients || [];

        // Redirect to login for pre-send/edit states.
        if (docData?.status === "draft" || docData?.status === "revert") {
          router.push("/");
          return;
        }

        if (!docData) {
          return;
        }

        setDocument(docData);

        const recipientData =
          recipientsData.find(
            (r) => r.email?.trim().toLowerCase() === normalizedEmail,
          ) || null;

        if (!recipientData) {
          return;
        }

        setRecipient(recipientData);
        setAllRecipients(recipientsData);

        // Set user name for chat
        setUserName(recipientData.name || linkEmail || "");

        await logDocumentOpened(linkEmail);

        // Fetch discussion signatures from chat
        try {
          const chatResponse = await fetch(
            `/api/chat-messages?documentId=${encodeURIComponent(
              String(id),
            )}&userEmail=${encodeURIComponent(linkEmail)}`,
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
      } catch (err) {
        console.error("Error loading sign document:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, email, router, router.isReady]);

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

  const handleSign = async () => {
    if (!signatureText.trim() || !recipient || !document) {
      alert("Please enter your signature");
      return;
    }

    setSigning(true);

    try {
      // Get client IP and user agent
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      const { ip } = await ipResponse.json();
      const userAgent = navigator.userAgent;

      // Get geo-location from IP
      const geoResponse = await fetch(
        `/api/get-location?ip=${encodeURIComponent(ip)}`,
      );
      const geoData = await geoResponse.json();
      setGeoDebug(JSON.stringify({ ip, geoData }, null, 2));
      //   if (geoData.error) {
      //     alert(`Location lookup error: ${geoData.error}`);
      //   }
      const country = geoData.country || "Unknown";
      const city = geoData.city || "Unknown";

      // Update recipient signature with geo-location
      const { error: updateError } = await supabase
        .from("recipients")
        .update({
          signature_text: signatureText,
          signed_at: new Date().toISOString(),
          signed_by_ip: ip,
          signed_by_country: country,
          signed_by_city: city,
          signed_by_user_agent: userAgent,
          status: "signed",
        })
        .eq("id", recipient.id);

      if (updateError) throw updateError;

      // Log the signing with all details
      await supabase.from("audit_logs").insert([
        {
          document_id: document.id,
          action: "DOCUMENT_SIGNED",
          actor_email: recipient.email,
          ip_address: ip,
          user_agent: userAgent,
          details: {
            recipient_name: recipient.name,
            recipient_company: recipient.company_name,
            country: country,
            city: city,
          },
        },
      ]);

      // alert(
      //   "Document signed successfully!\n\nGeoData: " +
      //     JSON.stringify({ ip, geoData }, null, 2),
      // );

      // Fetch ALL signer-type recipients to check if all have signed
      const { data: allRecipients, error: fetchError } = await supabase
        .from("recipients")
        .select("*")
        .eq("document_id", document.id);

      if (fetchError) {
        console.error("Error fetching recipients:", fetchError);
      }

      if (allRecipients && allRecipients.length > 0) {
        const signers = allRecipients.filter((r) => r.role === "signer");
        const allSignersSigned =
          signers.length > 0 && signers.every((r) => r.status === "signed");

        if (allSignersSigned) {
          // Call API to update document status (bypasses RLS)
          const apiResponse = await fetch("/api/update-document-status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              documentId: document.id,
              status: "completed",
            }),
          });

          const apiData = await apiResponse.json();

          if (apiResponse.ok && apiData.success) {
            // Log document completion
            await supabase.from("audit_logs").insert([
              {
                document_id: document.id,
                action: "DOCUMENT_COMPLETED",
                actor_email: "system",
                ip_address: ip,
                details: {
                  message: "All signers have signed the document",
                },
              },
            ]);
          } else {
            console.error("Error updating document status:", apiData.error);
          }
        }
      }

      // Wait 3 seconds so user can see the alert and debug info
      setTimeout(() => {
        router.push("/thank-you");
      }, 3000);
    } catch (err: any) {
      alert("Error signing document: " + err.message);
    } finally {
      setSigning(false);
    }
  };

  const confirmRevertDocument = async () => {
    if (!id || !recipient || !document) return;
    const reason = revertReason.trim();

    if (!reason) {
      alert("Please provide a revert reason.");
      return;
    }

    setRevertingDocument(true);
    try {
      const response = await fetch("/api/revert-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: String(id),
          actorEmail: recipient.email,
          actorName: recipient.name || recipient.email,
          reason,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to revert document");
      }

      setShowRevertModal(false);
      setRevertReason("");
      setDocument((prev) => (prev ? { ...prev, status: "revert" } : prev));
      setToast({
        id: String(Date.now()),
        message: data.message || "Document reverted successfully",
        type: "success",
      });
      setTimeout(() => {
        router.push("/");
      }, 1200);
    } catch (err: any) {
      alert("Error reverting document: " + err.message);
    } finally {
      setRevertingDocument(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!document || !recipient) {
    const urlDocId = Array.isArray(id) ? id[0] : id;
    const urlEmail = Array.isArray(email) ? email[0] : email;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center font-serif space-y-2">
          <p className="text-black text-sm sm:text-base">
            Document or recipient not found. Please check your signing link.
          </p>
          <p className="text-xs text-gray-600">Document ID: {urlDocId || "-"}</p>
          <p className="text-xs text-gray-600">Email: {urlEmail || "-"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                Revert will send this document back for editing.
              </p>
              <div className="w-full text-left">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Revert reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why this document should be reverted..."
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

      {/* {geoDebug && (
        <div
          style={{
            background: "#f5f5f5",
            color: "#333",
            padding: 12,
            margin: 12,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <b>GeoData Debug:</b>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {geoDebug}
          </pre>
        </div>
      )} */}
      {/* Header */}
      <header className=" shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <Image
            src="/bitsshake-logo-4.png"
            alt="BitsShake Logo"
            width={120}
            height={48}
            className="mx-auto"
          />
          <h1 className="mb-6 text-1xl sm:text-[20px] text-center font-semibold tracking-tight text-black/90 font-serif">
            Bits Shake
          </h1>

          <h1 className="text-2xl sm:text-[40px] text-center font-semibold tracking-tight text-black/90 font-serif">
            {document.title}
          </h1>
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
              {allRecipients.filter(
                (r) => r.role === "signer" && r.status === "signed",
              ).length > 0 && (
                <div className="mt-12 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 font-serif">
                    Signatures
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {allRecipients
                      .filter(
                        (r) => r.role === "signer" && r.status === "signed",
                      )
                      .map((signer) => (
                        <div
                          key={signer.id}
                          className="border-t-2 border-gray-900 pt-4"
                        >
                          <p
                            style={{
                              fontSize: "24px",
                              fontFamily: "cursive",
                            }}
                            className="text-gray-900 mb-2 font-serif"
                          >
                            {signer.signature_text || "_________________"}
                          </p>
                          <p className="text-sm text-gray-600 font-serif">
                            {signer.name || signer.email}
                          </p>
                          {signer.name && (
                            <p className="text-xs text-gray-500 font-serif">
                              {signer.email}
                            </p>
                          )}
                          {signer.signed_at && (
                            <p className="text-xs text-gray-500 mt-1 font-serif">
                              Signed:{" "}
                              {new Date(signer.signed_at).toLocaleString()}
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 font-serif">
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
                          <p className="text-sm font-semibold text-gray-900 font-serif">
                            {title}
                          </p>
                          {parsed.sigName && (
                            <p
                              className="mt-2 text-2xl text-gray-900 font-serif"
                              style={{
                                fontFamily: parsed.signatureFontFamily,
                              }}
                            >
                              {parsed.sigName}
                            </p>
                          )}
                          <div className="mt-2 text-xs text-gray-600 space-y-1 font-serif">
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

          {/* Signature panel */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="space-y-6">
              {/* Status */}
              <div>
                <p className="text-sm text-gray-600 font-serif">Your email:</p>
                <p className="font-medium text-gray-900 font-serif">
                  {recipient.email}
                </p>
                <p className="text-sm text-gray-600 mt-2 font-serif">
                  Your role: {recipient.role}
                </p>
              </div>

              {/* Signature type selection */}
              {recipient.role === "signer" &&
                recipient.status === "pending" && (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 font-serif">
                        Sign Document
                      </h3>
                      <div className="space-y-3">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="signatureType"
                            value="typed"
                            checked={signatureType === "typed"}
                            onChange={(e) =>
                              setSignatureType(
                                e.target.value as "typed" | "draw",
                              )
                            }
                            className="h-4 w-4 text-black"
                          />
                          <span className="ml-2 text-sm text-gray-700 font-serif">
                            Type signature
                          </span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="signatureType"
                            value="draw"
                            checked={signatureType === "draw"}
                            onChange={(e) =>
                              setSignatureType(
                                e.target.value as "typed" | "draw",
                              )
                            }
                            className="h-4 w-4 text-black"
                          />
                          <span className="ml-2 text-sm text-gray-700 font-serif">
                            Draw signature
                          </span>
                        </label>
                      </div>
                    </div>

                    {signatureType === "typed" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 font-serif">
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={signatureText}
                          onChange={(e) => setSignatureText(e.target.value)}
                          placeholder="Type your full name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-serif"
                        />

                        <label className="block text-sm font-medium text-gray-700 mt-4 mb-2 font-serif">
                          Signature Style
                        </label>
                        <select
                          value={signatureFont}
                          onChange={(e) => setSignatureFont(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-serif"
                        >
                          {fonts.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.name}
                            </option>
                          ))}
                        </select>

                        {signatureText && (
                          <div className="mt-4 p-4 border border-gray-300 rounded-md bg-gray-50 font-serif">
                            <p className="text-xs text-gray-600 mb-2 font-serif">
                              Preview:
                            </p>
                            <p
                              style={{
                                fontFamily:
                                  signatureFont === "cursive"
                                    ? "cursive"
                                    : signatureFont === "script"
                                      ? "script"
                                      : "Georgia, serif",
                                fontSize: "28px",
                                fontStyle:
                                  signatureFont === "formal"
                                    ? "italic"
                                    : "normal",
                              }}
                              className="text-gray-900 font-serif"
                            >
                              {signatureText}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {signatureType === "draw" && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2 font-serif">
                          Draw signature support coming soon. Please use "Type
                          signature" for now.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleSign}
                      disabled={signing || !signatureText.trim()}
                      className="w-full px-4 py-2 bg-black text-white rounded-md hover:bg-gray-700 disabled:opacity-50 font-medium font-serif"
                    >
                      {signing ? "Signing..." : "Sign Document"}
                    </button>
                  </>
                )}

              {recipient.status === "signed" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800 font-medium font-serif">
                    Document signed!
                  </p>
                  <p className="text-xs text-green-700 mt-2 font-serif">
                    Signed on:{" "}
                    {new Date(recipient.signed_at || "").toLocaleString()}
                  </p>
                </div>
              )}

              {recipient.role === "viewer" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-serif">
                    You are viewing this document as a viewer.
                  </p>
                </div>
              )}

              {recipient.role === "signer" && document.status === "sent" && (
                <button
                  onClick={() => setShowRevertModal(true)}
                  disabled={revertingDocument}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-medium font-serif"
                >
                  {revertingDocument ? "Reverting..." : "Revert"}
                </button>
              )}

              {/* Chat Panel - Always show for all document statuses */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 font-serif">
                  Discussion
                </h3>
                <div
                  style={{ height: "400px" }}
                  className="bg-white rounded-lg border border-gray-200"
                >
                  <ChatPanel
                    documentId={String(id)}
                    userEmail={String(email)}
                    userName={userName}
                    isAdmin={false}
                    recipients={recipient ? [recipient] : []}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
