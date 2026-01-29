import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Document, Recipient } from "@/lib/types";
import Image from "next/image";

export default function SignDocument() {
  const router = useRouter();
  const { id, email } = router.query;
  const [document, setDocument] = useState<Document | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signatureType, setSignatureType] = useState<"typed" | "draw">("typed");
  const [signatureText, setSignatureText] = useState("");
  const [signatureFont, setSignatureFont] = useState("cursive");

  const fonts = [
    { name: "Cursive", value: "cursive" },
    { name: "Script", value: "script" },
    { name: "Formal", value: "formal" },
  ];

  useEffect(() => {
    if (!id || !email) return;

    const fetchData = async () => {
      // Fetch document
      const { data: docData } = await supabase
        .from("documents")
        .select("*")
        .eq("id", id)
        .single();

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
        .eq("email", email)
        .single();

      if (!recipientData) {
        router.push("/");
        return;
      }

      setRecipient(recipientData);
      setLoading(false);
    };

    fetchData();
  }, [id, email, router]);

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

      alert("Document signed successfully!");

      // Fetch ALL signer-type recipients to check if all have signed
      const { data: allRecipients, error: fetchError } = await supabase
        .from("recipients")
        .select("*")
        .eq("document_id", document.id)
        .eq("role", "signer");

      if (fetchError) {
        console.error("Error fetching recipients:", fetchError);
      }

      if (allRecipients && allRecipients.length > 0) {
        const allSignersSigned = allRecipients.every(
          (r) => r.status === "signed",
        );

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

      router.push("/thank-you");
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
