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
          <p className="text-xs text-gray-600">
            Document ID: {urlDocId || "-"}
          </p>
          <p className="text-xs text-gray-600">Email: {urlEmail || "-"}</p>
        </div>
      </div>
    );
  }

  const signedRecipients = allRecipients.filter(
    (r) => r.role === "signer" && r.status === "signed",
  );
  const recipientStatusTone =
    recipient.status === "signed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : recipient.role === "viewer"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const recipientStatusLabel =
    recipient.status === "signed"
      ? "Signed"
      : recipient.role === "viewer"
        ? "Viewer access"
        : "Awaiting signature";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {showRevertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-8 shadow-[0_28px_90px_rgba(15,23,42,0.18)]">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
                <svg
                  className="h-8 w-8 text-rose-700"
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
              <h3 className="text-2xl font-semibold text-slate-900">
                Revert Document?
              </h3>
              <p className="text-sm leading-6 text-slate-600">
                Revert will send this document back for editing.
              </p>
              <div className="w-full text-left">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Revert reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why this document should be reverted..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/70"
                  disabled={revertingDocument}
                />
              </div>
              <div className="mt-2 flex w-full gap-3">
                <button
                  onClick={() => setShowRevertModal(false)}
                  disabled={revertingDocument}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRevertDocument}
                  disabled={revertingDocument || !revertReason.trim()}
                  className="flex-1 rounded-2xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
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
      <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,#f8fafc,white_50%,#eef2ff)] shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Secure signing
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${recipientStatusTone}`}
                  >
                    {recipientStatusLabel}
                  </span>
                </div>
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <Image
                      src="/bitsshake-logo-4.png"
                      alt="BitsShake Logo"
                      width={50}
                      height={50}
                    />
                  </div>
                  <div>
                    {/* <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Workspace
                    </p> */}
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      Bits Shake
                    </p>
                  </div>
                </div>
                <h1 className="mt-8 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl lg:text-5xl">
                  {document.title}
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                  Review the agreement, confirm your signature details, and sign
                  securely from this workspace.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Recipient
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {recipient.name || recipient.email}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {recipient.email}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Role
                  </p>
                  <p className="mt-2 text-sm font-semibold capitalize text-slate-900">
                    {recipient.role}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {recipient.role === "viewer"
                      ? "Read-only access"
                      : "Action required to complete"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Signatures
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {signedRecipients.length} completed
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {allRecipients.filter((r) => r.role === "signer").length}{" "}
                    total signer
                    {allRecipients.filter((r) => r.role === "signer").length ===
                    1
                      ? ""
                      : "s"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.75fr)_380px] lg:items-start">
          {/* Document content */}
          <div>
            <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-8 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Agreement
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      Document preview
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    Review before signing
                  </span>
                </div>
              </div>
              <div className="p-8">
                <div className="prose prose-lg max-w-none text-black">
                  <div
                    dangerouslySetInnerHTML={{ __html: document.content || "" }}
                    className="font-serif leading-relaxed text-slate-900"
                    style={{ lineHeight: "1.75" }}
                  />
                </div>

                {/* Signatures section */}
                {signedRecipients.length > 0 && (
                  <div className="mt-12 border-t border-slate-200 pt-8">
                    <h3 className="mb-6 text-lg font-semibold text-slate-900 font-serif">
                      Signatures
                    </h3>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {signedRecipients.map((signer) => (
                        <div
                          key={signer.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5"
                        >
                          <p
                            style={{
                              fontSize: "24px",
                              fontFamily: "cursive",
                            }}
                            className="mb-2 text-slate-900 font-serif"
                          >
                            {signer.signature_text || "_________________"}
                          </p>
                          <p className="text-sm text-slate-700 font-serif">
                            {signer.name || signer.email}
                          </p>
                          {signer.name && (
                            <p className="text-xs text-slate-500 font-serif">
                              {signer.email}
                            </p>
                          )}
                          {signer.signed_at && (
                            <p className="mt-1 text-xs text-slate-500 font-serif">
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
                  <div className="mt-12 border-t border-slate-200 pt-8">
                    <h3 className="mb-6 text-lg font-semibold text-slate-900 font-serif">
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
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                          >
                            <p className="text-sm font-semibold text-slate-900 font-serif">
                              {title}
                            </p>
                            {parsed.sigName && (
                              <p
                                className="mt-2 text-2xl text-slate-900 font-serif"
                                style={{
                                  fontFamily: parsed.signatureFontFamily,
                                }}
                              >
                                {parsed.sigName}
                              </p>
                            )}
                            <div className="mt-2 space-y-1 text-xs text-slate-600 font-serif">
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
          </div>

          {/* Signature panel */}
          <div className="space-y-6 lg:sticky lg:top-8">
            <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Signer panel
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {recipient.role === "viewer"
                    ? "Review access"
                    : "Complete your signature"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {recipient.role === "viewer"
                    ? "You can review the agreement and follow the discussion from here."
                    : "Confirm your details, preview your signature, and submit when you are ready."}
                </p>
              </div>
              <div className="space-y-6 p-6">
                {/* Status */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Your email
                    </p>
                    <p className="mt-2 break-all text-sm font-semibold text-slate-900 font-serif">
                      {recipient.email}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Your role
                    </p>
                    <p className="mt-2 text-sm font-semibold capitalize text-slate-900 font-serif">
                      {recipient.role}
                    </p>
                  </div>
                </div>

                {/* Signature type selection */}
                {recipient.role === "signer" &&
                  recipient.status === "pending" && (
                    <>
                      <div>
                        <h3 className="mb-4 text-lg font-semibold text-slate-900 font-serif">
                          Sign Document
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                          <label className="flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white">
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
                              className="h-4 w-4 text-slate-950"
                            />
                            <span className="ml-3 text-sm text-slate-700 font-serif">
                              Type signature
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white">
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
                              className="h-4 w-4 text-slate-950"
                            />
                            <span className="ml-3 text-sm text-slate-700 font-serif">
                              Draw signature
                            </span>
                          </label>
                        </div>
                      </div>

                      {signatureType === "typed" && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700 font-serif">
                            Your Name
                          </label>
                          <input
                            type="text"
                            value={signatureText}
                            onChange={(e) => setSignatureText(e.target.value)}
                            placeholder="Type your full name"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-serif text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/70"
                          />

                          <label className="mb-2 mt-4 block text-sm font-medium text-slate-700 font-serif">
                            Signature Style
                          </label>
                          <select
                            value={signatureFont}
                            onChange={(e) => setSignatureFont(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-serif text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/70"
                          >
                            {fonts.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.name}
                              </option>
                            ))}
                          </select>

                          {signatureText && (
                            <div className="mt-4 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-5 font-serif">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 font-serif">
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
                                className="text-slate-900 font-serif"
                              >
                                {signatureText}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {signatureType === "draw" && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                          <p className="text-sm text-amber-800 font-serif">
                            Draw signature support coming soon. Please use "Type
                            signature" for now.
                          </p>
                        </div>
                      )}

                      <button
                        onClick={handleSign}
                        disabled={signing || !signatureText.trim()}
                        className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 font-serif"
                      >
                        {signing ? "Signing..." : "Sign Document"}
                      </button>
                    </>
                  )}

                {recipient.status === "signed" && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-800 font-serif">
                      Document signed!
                    </p>
                    <p className="mt-2 text-xs text-emerald-700 font-serif">
                      Signed on:{" "}
                      {new Date(recipient.signed_at || "").toLocaleString()}
                    </p>
                  </div>
                )}

                {recipient.role === "viewer" && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                    <p className="text-sm text-sky-800 font-serif">
                      You are viewing this document as a viewer.
                    </p>
                  </div>
                )}

                {recipient.role === "signer" && document.status === "sent" && (
                  <button
                    onClick={() => setShowRevertModal(true)}
                    disabled={revertingDocument}
                    className="w-full rounded-2xl bg-rose-600 px-4 py-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 font-serif"
                  >
                    {revertingDocument ? "Reverting..." : "Revert"}
                  </button>
                )}
              </div>
            </div>

            {/* Chat Panel - Always show for all document statuses */}
            <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-6 py-5">
                <h3 className="text-lg font-semibold text-slate-900 font-serif">
                  Discussion
                </h3>
                <p className="mt-2 text-sm text-slate-600 font-serif">
                  Ask questions or clarify terms before the document is
                  completed.
                </p>
              </div>
              <div style={{ height: "400px" }} className="bg-white">
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
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
