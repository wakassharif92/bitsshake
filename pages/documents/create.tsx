import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Template, User } from "@/lib/types";
import { hasPremiumAccess } from "@/lib/subscription";

const dynamicVariables = [
  { label: "Client Name", value: "{clientName}" },
  { label: "Price", value: "{price}" },
  { label: "Upfront Fee", value: "{upfrontFee}" },
  { label: "Start Date", value: "{startDate}" },
  { label: "End Date", value: "{endDate}" },
  { label: "Total Days", value: "{totalDays}" },
];

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
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<
    { name: string; value: string }[]
  >([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {},
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const extractTemplateVariables = (html: string) => {
    const found = new Set<string>();
    const checkSource = (source: string) => {
      dynamicVariables.forEach((variable) => {
        if (source.includes(variable.value)) {
          found.add(variable.value.replace(/[{}]/g, ""));
        }
      });
    };

    checkSource(html || "");

    try {
      const textContent =
        typeof window !== "undefined"
          ? new DOMParser().parseFromString(html, "text/html").body
              .textContent || ""
          : html.replace(/<[^>]*>/g, "");
      checkSource(textContent);
    } catch {
      const fallbackText = (html || "").replace(/<[^>]*>/g, "");
      checkSource(fallbackText);
    }

    return Array.from(found);
  };

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
      const templateContent = template.content || "";
      setContent(templateContent);

      const extractedNames = extractTemplateVariables(templateContent);

      if (extractedNames.length > 0) {
        // Found variables, show modal to fill them
        const extractedVars = extractedNames.map((varName) => {
          const varDef = dynamicVariables.find(
            (v) => v.value === `{${varName}}`,
          );
          return {
            name: varName,
            value: varDef?.label || varName,
          };
        });

        setTemplateVariables(extractedVars);
        // Initialize variable values
        const initialValues: Record<string, string> = {};
        extractedVars.forEach((v) => {
          initialValues[v.name] = "";
        });
        setVariableValues(initialValues);
        setShowVariableModal(true);
      }
    }
  };

  const handleApplyVariables = () => {
    let updatedContent = content;

    // Replace all variable placeholders with their values
    Object.entries(variableValues).forEach(([varName, varValue]) => {
      const placeholder = `{${varName}}`;
      updatedContent = updatedContent.replaceAll(placeholder, varValue);
    });

    setContent(updatedContent);
    setShowVariableModal(false);
    setTemplateVariables([]);
    setVariableValues({});
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasPremiumAccess(currentUser)) {
      alert("Your subscription is inactive. Please upgrade to continue.");
      return;
    }

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

  const isLocked = !hasPremiumAccess(currentUser);

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
            disabled={loading || !title.trim() || isLocked}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? "Creating..." : "Create Document"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-7xl mx-auto w-full h-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
          {isLocked && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your trial has ended. Please upgrade to create documents.
              <Link href="/pricing" className="ml-2 font-semibold underline">
                View pricing
              </Link>
            </div>
          )}
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

      {/* Variable Modal */}
      {showVariableModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Fill Template Variables
              </h2>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {templateVariables.map((variable) => (
                  <div key={variable.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {variable.value}
                    </label>
                    <input
                      type="text"
                      value={variableValues[variable.name] || ""}
                      onChange={(e) => {
                        setVariableValues({
                          ...variableValues,
                          [variable.name]: e.target.value,
                        });
                      }}
                      placeholder={`Enter ${variable.value.toLowerCase()}`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowVariableModal(false);
                    setTemplateVariables([]);
                    setVariableValues({});
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyVariables}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Apply Variables
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
