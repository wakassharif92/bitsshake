import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { User } from "@/lib/types";
import { hasPremiumAccess } from "@/lib/subscription";

export default function UploadDocument() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      setCurrentUser(userData || null);
      setLoading(false);
    };

    fetchData();
  }, [router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasPremiumAccess(currentUser)) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("pdf")) {
      alert("Please upload a PDF file");
      return;
    }

    setUploading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const fileName = `${session.user.id}/${Date.now()}_${file.name}`;

      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Create document record
      const { data, error } = await supabase
        .from("documents")
        .insert([
          {
            admin_id: session.user.id,
            title: file.name.replace(/\.pdf$/i, ""),
            file_name: file.name,
            file_url: publicData.publicUrl,
            status: "draft",
            is_uploaded: true,
          },
        ])
        .select();

      if (error) throw error;

      // Reset file input
      e.target.value = "";
      router.push(`/documents/${data[0].id}/edit`);
    } catch (err: any) {
      alert("Error uploading document: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isLocked = !hasPremiumAccess(currentUser);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="text-gray-600 hover:text-gray-900">
                ← Back
              </button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Upload Document
            </h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLocked && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your trial has ended. Please upgrade to upload documents.
            <Link href="/pricing" className="ml-2 font-semibold underline">
              View pricing
            </Link>
          </div>
        )}
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Upload PDF Document
          </h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={uploading || isLocked}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`flex flex-col items-center gap-2 ${
                isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
            >
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-gray-600">
                {uploading
                  ? "Uploading..."
                  : isLocked
                    ? "Upgrade to upload PDFs"
                    : "Click to upload PDF"}
              </span>
              <span className="text-sm text-gray-500">PDF files only</span>
            </label>
          </div>
        </div>

        {!uploading && (
          <div className="text-center py-12">
            <p className="text-gray-600">
              Upload a PDF to continue to recipient setup.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
