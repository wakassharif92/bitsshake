import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Document, Recipient } from "@/lib/types";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [sendingDocument, setSendingDocument] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newRecipient, setNewRecipient] = useState({
    email: "",
    name: "",
    company_name: "",
    role: "signer" as "signer" | "viewer",
  });

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
  }, [id, router]);

  const handleSaveDocument = async () => {
    if (!id || !document) return;

    setSaving(true);
    try {
      await supabase
        .from("documents")
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq("id", id);

      setDocument({ ...document, title, content });
      alert("Document saved successfully");
    } catch (err: any) {
      alert("Error saving document: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecipient = async () => {
    if (!newRecipient.email.trim() || !newRecipient.name.trim() || !id) {
      alert("Please fill in all required fields (Email and Name)");
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
        role: "signer",
      });
      setShowModal(false);
    } catch (err: any) {
      alert("Error adding recipient: " + err.message);
    } finally {
      setAddingRecipient(false);
    }
  };

  const handleRemoveRecipient = async (recipientId: string) => {
    if (!confirm("Remove this recipient?")) return;

    try {
      await supabase.from("recipients").delete().eq("id", recipientId);

      setRecipients(recipients.filter((r) => r.id !== recipientId));
    } catch (err: any) {
      alert("Error removing recipient: " + err.message);
    }
  };

  const handleSendDocument = async () => {
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
      router.push("/dashboard");
    } catch (err: any) {
      alert("Error sending document: " + err.message);
    } finally {
      setSendingDocument(false);
    }
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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <button className="text-gray-600 hover:text-gray-900">
                  ← Back
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Edit Document
                </h1>
                <p className="text-sm text-gray-600">
                  Status: {document.status}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveDocument}
                disabled={saving}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Document"}
              </button>
              <button
                onClick={handleSendDocument}
                disabled={document.status !== "draft" || sendingDocument}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sendingDocument ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Sending...
                  </>
                ) : (
                  "Send to Recipients"
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 lg:px-8 py-4">
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
            />
          </div>

          {/* Rich text editor - full remaining height */}
          <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-lg border border-gray-300">
            <RichEditor content={content} onChange={setContent} />
          </div>
        </div>

        {/* Recipients sidebar */}
        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Recipients</h2>
              <button
                onClick={() => setShowModal(true)}
                disabled={document.status !== "draft"}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                + Add
              </button>
            </div>

            <div className="space-y-3">
              {recipients.length === 0 ? (
                <p className="text-gray-500 text-sm">No recipients added yet</p>
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
                          <p className="text-xs text-gray-600 mt-1">
                            Signed:{" "}
                            {new Date(recipient.signed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {document.status === "draft" && (
                        <button
                          onClick={() => handleRemoveRecipient(recipient.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
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
        </div>
      </main>

      {/* Add recipient modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Add Recipient
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newRecipient.email}
                  onChange={(e) =>
                    setNewRecipient({ ...newRecipient, email: e.target.value })
                  }
                  placeholder="recipient@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRecipient.name}
                  onChange={(e) =>
                    setNewRecipient({ ...newRecipient, name: e.target.value })
                  }
                  placeholder="Full Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="signer">Signer</option>
                  <option value="viewer">Viewer</option>
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addingRecipient ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Adding...
                    </>
                  ) : (
                    "Add Recipient"
                  )}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={addingRecipient}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-md hover:bg-gray-400 disabled:bg-gray-200"
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
