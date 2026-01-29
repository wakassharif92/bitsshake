import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Template } from "@/lib/types";

const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
});

export default function CreateDocument() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      // Fetch templates
      const { data: templatesData } = await supabase
        .from("templates")
        .select("*")
        .eq("admin_id", session.user.id)
        .order("created_at", { ascending: false });

      setTemplates(templatesData || []);
      setFetching(false);
    };

    fetchData();
  }, [router]);

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setTitle(template.name);
      setContent(template.content || "");
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Please enter a document title");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("documents")
        .insert([
          {
            admin_id: session.user.id,
            title,
            content,
            template_id: selectedTemplate || null,
            status: "draft",
          },
        ])
        .select();

      if (error) throw error;

      // Create audit log
      await supabase.from("audit_logs").insert([
        {
          document_id: data[0].id,
          action: "DOCUMENT_CREATED",
          actor_email: session.user.email,
        },
      ]);

      router.push(`/documents/${data[0].id}/edit`);
    } catch (err: any) {
      alert("Error creating document: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
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
              Create Document
            </h1>
          </div>
          <button
            onClick={handleCreateDocument}
            disabled={loading || !title.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? "Creating..." : "Create Document"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-7xl mx-auto w-full h-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
          {/* Title input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          {/* Template selection */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Load from template (optional)
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  setSelectedTemplate(e.target.value);
                  if (e.target.value) {
                    handleLoadTemplate(e.target.value);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              >
                <option value="">Select a template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Rich text editor - full remaining height */}
          <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-lg border border-gray-300">
            <RichEditor content={content} onChange={setContent} />
          </div>
        </div>
      </main>
    </div>
  );
}
