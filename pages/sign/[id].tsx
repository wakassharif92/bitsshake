import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ChatMessage, Document, Recipient } from "@/lib/types";
import Image from "next/image";
import ChatPanel from "@/components/ChatPanel";

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

  const fonts = [
    { name: "Cursive", value: "cursive" },
    { name: "Script", value: "script" },
    { name: "Formal", value: "formal" },
  ];

  useEffect(() => {
    if (!id || !email) return;

    const linkEmailRaw = Array.isArray(email) ? email[0] : email;
    const linkEmail = linkEmailRaw ? decodeURIComponent(linkEmailRaw) : "";

    const fetchData = async () => {
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

      // Fetch document
      const { data: docData } = await supabase
        .from("documents")
        .select("*")
        .eq("id", id)
        .single();

      // Only block draft documents, allow all others (sent, signed, completed, uploaded)
      if (!docData || docData.status === "draft") {
        router.push("/");
        return;
      }

      setDocument(docData);

      // Fetch recipient
      const { data: recipientData } = await supabase
        .from("recipients")
        .select("*")
        .eq("document_id", id)
        .eq("email", linkEmail)
        .single();

      if (!recipientData) {
        router.push("/");
        return;
      }

      setRecipient(recipientData);

      // Set user name for chat
      setUserName(recipientData.name || linkEmail || "");

      await logDocumentOpened(linkEmail);

      // Fetch all signers via API to bypass RLS for viewers/signers
      const signersResponse = await fetch(
        `/api/get-signers?documentId=${encodeURIComponent(
          String(id),
        )}&email=${encodeURIComponent(linkEmail)}`,
      );

      if (signersResponse.ok) {
        const signersData = await signersResponse.json();
        setAllRecipients(signersData || []);
      } else {
        setAllRecipients([]);
      }

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
      setLoading(false);
    };

    fetchData();
  }, [id, email, router]);

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

      alert(
        "Document signed successfully!\n\nGeoData: " +
          JSON.stringify({ ip, geoData }, null, 2),
      );

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!document || !recipient) {
    return <div>Document or recipient not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <Image
            src="/bitsshake-02.png"
            alt="BitsShake Logo"
            width={120}
            height={48}
            className="mb-2"
          />
          <p className="text-sm text-gray-600 mt-1">{document.title}</p>
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">
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
                            className="text-gray-900 mb-2"
                          >
                            {signer.signature_text || "_________________"}
                          </p>
                          <p className="text-sm text-gray-600">
                            {signer.name || signer.email}
                          </p>
                          {signer.name && (
                            <p className="text-xs text-gray-500">
                              {signer.email}
                            </p>
                          )}
                          {signer.signed_at && (
                            <p className="text-xs text-gray-500 mt-1">
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

          {/* Signature panel */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="space-y-6">
              {/* Status */}
              <div>
                <p className="text-sm text-gray-600">Your email:</p>
                <p className="font-medium text-gray-900">{recipient.email}</p>
                <p className="text-sm text-gray-600 mt-2">
                  Your role: {recipient.role}
                </p>
              </div>

              {/* Signature type selection */}
              {recipient.role === "signer" &&
                recipient.status === "pending" && (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
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
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-700">
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
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Draw signature
                          </span>
                        </label>
                      </div>
                    </div>

                    {signatureType === "typed" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={signatureText}
                          onChange={(e) => setSignatureText(e.target.value)}
                          placeholder="Type your full name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />

                        <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">
                          Signature Style
                        </label>
                        <select
                          value={signatureFont}
                          onChange={(e) => setSignatureFont(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {fonts.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.name}
                            </option>
                          ))}
                        </select>

                        {signatureText && (
                          <div className="mt-4 p-4 border border-gray-300 rounded-md bg-gray-50">
                            <p className="text-xs text-gray-600 mb-2">
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
                              className="text-gray-900"
                            >
                              {signatureText}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {signatureType === "draw" && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          Draw signature support coming soon. Please use "Type
                          signature" for now.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleSign}
                      disabled={signing || !signatureText.trim()}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      {signing ? "Signing..." : "Sign Document"}
                    </button>
                  </>
                )}

              {recipient.status === "signed" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800 font-medium">
                    Document signed!
                  </p>
                  <p className="text-xs text-green-700 mt-2">
                    Signed on:{" "}
                    {new Date(recipient.signed_at || "").toLocaleString()}
                  </p>
                </div>
              )}

              {recipient.role === "viewer" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    You are viewing this document as a viewer.
                  </p>
                </div>
              )}

              {/* Chat Panel - Always show for all document statuses */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
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
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
