import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  documentId: string;
  userEmail: string;
  userName: string;
  isAdmin: boolean;
  isDisabled?: boolean;
}

export default function ChatPanel({
  documentId,
  userEmail,
  userName,
  isAdmin,
  isDisabled = false,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showLocation, setShowLocation] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [signatureReason, setSignatureReason] = useState("");
  const [signatureStyle, setSignatureStyle] = useState<
    "cursive" | "script" | "normal"
  >("cursive");
  const [canAddSignature, setCanAddSignature] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getSignatureFontFamily = (style: "cursive" | "script" | "normal") => {
    if (style === "script") {
      return "'Brush Script MT', 'Segoe Script', cursive";
    }
    if (style === "normal") {
      return "inherit";
    }
    return "'Comic Sans MS', 'Bradley Hand', cursive";
  };

  useEffect(() => {
    fetchConfig();
    fetchMessages();
    checkSignaturePermission();
    // Refresh messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [documentId]);

  useEffect(() => {
    checkSignaturePermission();
  }, [documentId, userEmail]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(
        `/api/chat-messages?documentId=${documentId}&userEmail=${encodeURIComponent(userEmail)}`,
      );
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkSignaturePermission = async () => {
    try {
      if (!documentId || !userEmail) {
        setCanAddSignature(false);
        return;
      }

      const response = await fetch(
        `/api/get-signers?documentId=${encodeURIComponent(
          documentId,
        )}&email=${encodeURIComponent(userEmail)}`,
      );

      if (!response.ok) {
        setCanAddSignature(false);
        return;
      }

      const signers = await response.json();
      const normalizedEmail = userEmail.trim().toLowerCase();
      const current = (signers || []).find(
        (r: any) => (r.email || "").toLowerCase() === normalizedEmail,
      );

      setCanAddSignature(current?.status === "signed");
    } catch (err) {
      console.error("Error checking signature permission:", err);
      setCanAddSignature(false);
    }
  };

  const sendMessage = async (
    messageText: string,
    fileToUpload?: File | null,
  ) => {
    if (isDisabled) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      return;
    }
    if (!messageText.trim()) return;

    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      let senderIp: string | undefined;
      let senderLocation: string | undefined;

      // Get client IP and location (same as signing flow)
      try {
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          senderIp = ipData.ip;

          // Get geo-location from IP
          if (senderIp) {
            const geoResponse = await fetch(
              `/api/get-location?ip=${encodeURIComponent(senderIp)}`,
            );
            if (geoResponse.ok) {
              const geoData = await geoResponse.json();
              senderLocation = `${geoData.city || "Unknown"}, ${geoData.country || "Unknown"}`;
            }
          }
        }
      } catch (err) {
        console.error("Error getting IP/location:", err);
      }

      // Upload file if selected
      if (fileToUpload) {
        const fileName = `${documentId}/${Date.now()}_${fileToUpload.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(fileName, fileToUpload);

        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        const { data: publicData } = supabase.storage
          .from("documents")
          .getPublicUrl(fileName);

        attachmentUrl = publicData.publicUrl;
        attachmentName = fileToUpload.name;
      }

      const response = await fetch("/api/chat-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          message: messageText,
          senderEmail: userEmail,
          senderName: userName,
          senderIp,
          senderLocation,
          attachmentUrl,
          attachmentName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `HTTP ${response.status}: Failed to send message`,
        );
      }

      await fetchMessages();
    } catch (err: any) {
      const errorMessage = err.message || "Failed to send message";
      console.error("Error sending message:", err);
      alert(`Error sending message: ${errorMessage}`);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    const messageText = message;
    const fileToUpload = selectedFile;
    setMessage("");
    setSelectedFile(null);
    await sendMessage(messageText, fileToUpload);
  };

  const handleAddSignature = async () => {
    if (isDisabled) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      return;
    }
    const name = signatureName.trim();
    const reason = signatureReason.trim();
    if (!name || !reason) return;
    const signatureMessage = `[SIGNATURE] ${name} || ${reason} || ${signatureStyle}`;
    setSignatureName("");
    setSignatureReason("");
    setSignatureStyle("cursive");
    setShowSignatureModal(false);
    await sendMessage(signatureMessage, null);
  };

  const handleDownloadConversation = async () => {
    if (isDisabled) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      return;
    }
    try {
      const response = await fetch("/api/chat-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `conversation_${documentId}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(
        `Failed to download conversation: ${err.message || "Unknown error"}`,
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat Heading */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-4">
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isSignature = msg.message?.startsWith("[SIGNATURE]");
            const showHeader = msg.sender_email !== userEmail || isSignature;
            const signatureBody = isSignature
              ? msg.message.replace("[SIGNATURE]", "").trim()
              : "";
            const [sigName, sigReason, sigStyleRaw] = signatureBody
              ? signatureBody.split("||").map((part) => part.trim())
              : ["", "", ""];
            const sigStyle =
              sigStyleRaw === "script" || sigStyleRaw === "normal"
                ? sigStyleRaw
                : "cursive";
            const signatureFontFamily = getSignatureFontFamily(sigStyle);

            return (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender_email === userEmail
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs ${
                    isSignature
                      ? "bg-amber-100 text-amber-900 border border-amber-200"
                      : msg.sender_email === userEmail
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-900"
                  } rounded-lg p-3`}
                >
                  {showHeader && (
                    <div className="mb-2 border-b pb-2 border-gray-400">
                      <p className="text-xs font-bold text-gray-800">
                        {msg.sender_name || msg.sender_email}
                      </p>
                      <p className="text-xs text-gray-700">
                        {msg.sender_email}
                      </p>
                      {showLocation && (
                        <>
                          {msg.sender_location &&
                            msg.sender_location !== "Unknown" && (
                              <p className="text-xs text-gray-700">
                                📍 {msg.sender_location}
                              </p>
                            )}
                          {msg.sender_ip && (
                            <p className="text-xs text-gray-700">
                              🌐 IP: {msg.sender_ip}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {isSignature ? (
                    <div className="text-sm">
                      <p className="font-semibold">✍️ Signature added</p>
                      {sigName && (
                        <p className="mt-1">
                          <span className="font-semibold"></span>{" "}
                          <span
                            className="text-[30px] leading-tight"
                            style={{ fontFamily: signatureFontFamily }}
                          >
                            {sigName}
                          </span>
                        </p>
                      )}
                      {sigReason && (
                        <p className="break-words  mt-1">Reason: {sigReason}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm break-words">{msg.message}</p>
                  )}
                  {msg.attachment_url && (
                    <a
                      href={msg.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs mt-2 underline block"
                    >
                      📎 {msg.attachment_name}
                    </a>
                  )}
                  <p className="text-xs mt-1 opacity-75">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 bg-white space-y-3">
        {isDisabled && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Chat is disabled. Upgrade to continue.
          </div>
        )}
        {selectedFile && (
          <div className="flex items-center justify-between bg-gray-100 p-2 rounded text-sm">
            <span>📎 {selectedFile.name}</span>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-1.5 items-end">
          <div className="relative">
            <button
              onClick={() => setShowMenuDropdown(!showMenuDropdown)}
              className="py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-300 flex-shrink-0"
              disabled={sending || isDisabled}
              title="More options"
            >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
            {showMenuDropdown && (
              <div className="absolute bottom-12 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
                <button
                  onClick={() => {
                    handleDownloadConversation();
                    setShowMenuDropdown(false);
                  }}
                  disabled={sending || isDisabled}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download Conversation
                </button>
                <label
                  className={`w-full text-left px-4 py-3 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                    isDisabled
                      ? "opacity-60 cursor-not-allowed text-gray-400"
                      : "cursor-pointer text-gray-700"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Attach File
                  <input
                    type="file"
                    onChange={(e) => {
                      setSelectedFile(e.target.files?.[0] || null);
                      setShowMenuDropdown(false);
                    }}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.png"
                    disabled={isDisabled}
                  />
                </label>
              </div>
            )}
          </div>
          <div className="relative flex-1">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.shiftKey)) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message... (Shift+Enter or Ctrl+Enter to send)"
              className="w-full px-4 py-3 pr-12 text-sm text-black placeholder-gray-500 bg-white border border-gray-300 focus:outline-none resize-none"
              rows={3}
              disabled={sending || isDisabled}
              style={{
                maxHeight: "150px",
                minHeight: "auto",
                overflow: "auto",
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={sending || !message.trim() || isDisabled}
              className="absolute bottom-2 right-2 p-2 text-black rounded-full font-medium hover:bg-gray-100 transition-all duration-300 ease-out disabled:opacity-50 flex items-center justify-center"
            >
              {sending ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.40337696,22.99 3.50612381,23.1 4.13399899,22.99 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.01 C3.34915502,0.9 2.40337696,0.99 1.77946707,1.4632036 C0.994623095,2.0974054 0.837654326,3.1868184 1.15159189,3.97230524 L3.03521743,10.4132983 C3.03521743,10.5703957 3.34915502,10.7274931 3.50612381,10.7274931 L16.6915026,11.5129799 C16.6915026,11.5129799 17.1624089,11.5129799 17.1624089,12.0374696 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {canAddSignature && (
          <button
            onClick={() => setShowSignatureModal(true)}
            className="px-4 py-2 bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] text-white rounded-full text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            ✍️ Signature
          </button>
        )}
      </div>

      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Add signature
              </h3>
              <p className="text-sm text-gray-600">
                Why are you adding a signature?
              </p>
            </div>
            <input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder='Your name (e.g., "John Doe")'
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-black placeholder-gray-500"
              style={{ fontFamily: getSignatureFontFamily(signatureStyle) }}
            />
            <div className="space-y-2">
              <label className="text-sm text-gray-700 font-medium">
                Signature style
              </label>
              <select
                value={signatureStyle}
                onChange={(e) =>
                  setSignatureStyle(
                    e.target.value as "cursive" | "script" | "normal",
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-black"
              >
                <option value="cursive">Cursive</option>
                <option value="script">Script</option>
                <option value="normal">Normal</option>
              </select>
            </div>
            <textarea
              value={signatureReason}
              onChange={(e) => setSignatureReason(e.target.value)}
              placeholder='e.g., "I have sent money for 1st milestone"'
              className="w-full min-h-[110px] px-3 py-2 border border-gray-300 rounded text-sm text-black placeholder-gray-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSignatureModal(false);
                  setSignatureReason("");
                  setSignatureName("");
                  setSignatureStyle("cursive");
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                disabled={sending || isDisabled}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSignature}
                disabled={
                  sending ||
                  !signatureName.trim() ||
                  !signatureReason.trim() ||
                  isDisabled
                }
                className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50"
              >
                Add signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
