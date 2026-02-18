import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Template } from "@/lib/types";

const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
});

export default function Templates() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isTrialExpired, setIsTrialExpired] = useState(false);

  const dynamicVariables = [
    { label: "Client Name", value: "{clientName}" },
    { label: "Price", value: "{price}" },
    { label: "Upfront Fee", value: "{upfrontFee}" },
    { label: "Start Date", value: "{startDate}" },
    { label: "End Date", value: "{endDate}" },
    { label: "Total Days", value: "{totalDays}" },
  ];

  useEffect(() => {
    const fetchTemplates = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("id, created_at, trial_end_at")
        .eq("id", session.user.id)
        .single();

      const trialEnd = userData?.trial_end_at
        ? new Date(userData.trial_end_at)
        : userData?.created_at
          ? new Date(
              new Date(userData.created_at).getTime() +
                30 * 24 * 60 * 60 * 1000,
            )
          : null;

      if (trialEnd && trialEnd <= new Date()) {
        setIsTrialExpired(true);
      }

      const { data } = await supabase
        .from("templates")
        .select("*")
        .eq("admin_id", session.user.id)
        .order("created_at", { ascending: false });

      setTemplates(data || []);
      setLoading(false);
    };

    fetchTemplates();
  }, [router]);

  const handleSaveTemplate = async () => {
    if (!newTemplate.name.trim()) {
      alert("Please enter a template name");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      if (editingId) {
        // Update existing template
        const { error } = await supabase
          .from("templates")
          .update({
            name: newTemplate.name,
            content: newTemplate.content,
          })
          .eq("id", editingId);

        if (error) throw error;

        setTemplates(
          templates.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  name: newTemplate.name,
                  content: newTemplate.content,
                }
              : t,
          ),
        );
      } else {
        // Create new template
        const { data, error } = await supabase
          .from("templates")
          .insert([
            {
              admin_id: session.user.id,
              name: newTemplate.name,
              content: newTemplate.content,
            },
          ])
          .select();

        if (error) throw error;

        setTemplates([...templates, data[0]]);
      }

      setNewTemplate({ name: "", content: "" });
      setEditingId(null);
      setShowModal(false);
    } catch (err: any) {
      alert("Error saving template: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTemplate = (template: Template) => {
    setNewTemplate({ name: template.name, content: template.content || "" });
    setEditingId(template.id);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNewTemplate({ name: "", content: "" });
    setEditingId(null);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;

    try {
      await supabase.from("templates").delete().eq("id", id);
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err: any) {
      alert("Error deleting template: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isTrialExpired) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <button className="text-gray-600 hover:text-gray-900">
                    ← Back
                  </button>
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
              </div>
              <Link href="/pricing">
                <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                  Upgrade
                </button>
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto py-16 px-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-900">
            Your free trial has ended
          </h2>
          <p className="mt-3 text-gray-600">
            Please upgrade to continue using templates.
          </p>
          <div className="mt-8">
            <Link href="/pricing">
              <button className="px-8 py-3 rounded-full bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] text-white font-semibold">
                View pricing
              </button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <button className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-black/80 transition-colors">
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
            </div>
            <button
              onClick={() => {
                setNewTemplate({ name: "", content: "" });
                setEditingId(null);
                setShowModal(true);
              }}
              className="px-8 py-2.5 rounded-full text-[15px] font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              Create Template
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {templates.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 mb-4">No templates yet</p>
              <button
                onClick={() => setShowModal(true)}
                className="px-8 py-2.5 rounded-full text-[15px] font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02]"
              >
                Create your first template
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {templates.map((template) => (
                    <tr key={template.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {template.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(template.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                        <button
                          onClick={() => handleEditTemplate(template)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingId ? "Edit Template" : "Create Template"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, name: e.target.value })
                  }
                  placeholder="e.g., Service Agreement"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Content
                  </label>
                  <div className="text-xs text-gray-600">
                    Click below to insert dynamic variables
                  </div>
                </div>

                {/* Dynamic Variables Buttons */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {dynamicVariables.map((variable) => (
                    <button
                      key={variable.value}
                      onClick={() => {
                        setNewTemplate({
                          ...newTemplate,
                          content: newTemplate.content + variable.value,
                        });
                      }}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 border border-blue-300"
                    >
                      +{variable.label}
                    </button>
                  ))}
                </div>
                <div className="bg-white rounded-lg border border-gray-300 overflow-hidden flex flex-col flex-1">
                  <RichEditor
                    content={newTemplate.content}
                    onChange={(content) =>
                      setNewTemplate({ ...newTemplate, content })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-2 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleSaveTemplate}
                disabled={saving || !newTemplate.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Template"
                    : "Create Template"}
              </button>
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-md hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
