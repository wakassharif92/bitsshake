import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  documentId: string;
  userEmail: string;
  userName: string;
  isAdmin: boolean;
}

export default function ChatPanel({
  documentId,
  userEmail,
  userName,
  isAdmin,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showLocation, setShowLocation] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConfig();
    fetchMessages();
    // Refresh messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [documentId]);

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

  const handleSendMessage = async () => {
    if (!message.trim()) return;

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
      if (selectedFile) {
        const fileName = `${documentId}/${Date.now()}_${selectedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(fileName, selectedFile);

        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        const { data: publicData } = supabase.storage
          .from("documents")
          .getPublicUrl(fileName);

        attachmentUrl = publicData.publicUrl;
        attachmentName = selectedFile.name;
      }

      const response = await fetch("/api/chat-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          message,
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

      setMessage("");
      setSelectedFile(null);
      await fetchMessages();
    } catch (err: any) {
      const errorMessage = err.message || "Failed to send message";
      console.error("Error sending message:", err);
      alert(`Error sending message: ${errorMessage}`);
    } finally {
      setSending(false);
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
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-4">
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender_email === userEmail ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs ${
                  msg.sender_email === userEmail
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-900"
                } rounded-lg p-3`}
              >
                {msg.sender_email !== userEmail && (
                  <div className="mb-2 border-b pb-2 border-gray-400">
                    <p className="text-xs font-bold text-gray-800">
                      {msg.sender_name || msg.sender_email}
                    </p>
                    <p className="text-xs text-gray-700">{msg.sender_email}</p>
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
                <p className="text-sm break-words">{msg.message}</p>
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
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 bg-white space-y-3">
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
        <div className="flex gap-2">
          <label className="flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 cursor-pointer text-sm">
            📎
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.jpg,.png"
            />
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") handleSendMessage();
            }}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-black placeholder-gray-500"
            disabled={sending}
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !message.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
