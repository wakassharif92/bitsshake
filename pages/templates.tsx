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
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(
    null,
  );
  const [deletingTemplate, setDeletingTemplate] = useState(false);

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
    try {
      setDeletingTemplate(true);
      await supabase.from("templates").delete().eq("id", id);
      setTemplates(templates.filter((t) => t.id !== id));
      setTemplateToDelete(null);
    } catch (err: any) {
      alert("Error deleting template: " + err.message);
    } finally {
      setDeletingTemplate(false);
    }
  };

  const totalTemplates = templates.length;
  const templatesWithContent = templates.filter(
    (template) => !!template.content?.trim(),
  ).length;
  const newestTemplate = templates[0] || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (isTrialExpired) {
    return (
      <div className="min-h-screen bg-gray-50 text-slate-900">
        <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <button className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-950 text-white shadow-sm transition-colors hover:bg-slate-800">
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
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Templates
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                    Template Library
                  </h1>
                </div>
              </div>
              <Link href="/pricing">
                <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                  Upgrade
                </button>
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-16">
          <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="bg-[linear-gradient(135deg,#f8fafc,white_55%,#eef2ff)] px-8 py-12 text-center sm:px-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Access required
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Your free trial has ended
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600">
                Upgrade to save reusable agreement layouts, speed up document
                creation, and keep your common terms organized in one place.
              </p>
              <div className="mt-8 flex justify-center gap-3">
                <Link href="/pricing">
                  <button className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                    View Pricing
                  </button>
                </Link>
                <Link href="/dashboard">
                  <button className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                    Back to Dashboard
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-8 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
                <svg
                  className="h-8 w-8 text-rose-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-slate-900">
                Delete Template?
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                <span className="font-medium text-slate-900">
                  {templateToDelete.name}
                </span>{" "}
                will be removed permanently. This action cannot be undone.
              </p>
              <div className="mt-6 flex w-full gap-3">
                <button
                  onClick={() => setTemplateToDelete(null)}
                  disabled={deletingTemplate}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTemplate(templateToDelete.id)}
                  disabled={deletingTemplate}
                  className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {deletingTemplate ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Link href="/dashboard">
                <button className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-950 text-white shadow-sm transition-colors hover:bg-slate-800">
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
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Templates
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Reusable content library
                  </span>
                </div>
                <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] text-slate-950 sm:text-4xl">
                  Template Library
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Save your most-used agreements and clauses so new documents
                  start with structure instead of blank pages.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Total templates
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {totalTemplates}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Saved to your workspace
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Ready to use
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {templatesWithContent}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      With template content
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Latest update
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {newestTemplate
                        ? new Date(newestTemplate.created_at).toLocaleDateString()
                        : "--"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Most recent template
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 lg:max-w-xs lg:items-end">
              <button
                onClick={() => {
                  setNewTemplate({ name: "", content: "" });
                  setEditingId(null);
                  setShowModal(true);
                }}
                className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 lg:w-auto"
              >
                Create Template
              </button>
              <Link href="/documents/create" className="w-full lg:w-auto">
                <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                  Use in Document
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Library
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  Saved Templates
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Edit reusable wording, refine structure, and launch new
                  documents faster.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                {templates.length} template{templates.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="px-6 py-16 text-center sm:px-8">
              <div className="mx-auto max-w-xl rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Empty library
                </p>
                <h3 className="mt-4 text-2xl font-semibold text-slate-900">
                  No templates yet
                </h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                  Start with a reusable contract, proposal, or service
                  agreement so future documents can be generated in seconds.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-8 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Create Your First Template
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-8">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.map((template) => (
                    <tr
                      key={template.id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-6 py-5 text-sm text-slate-900 sm:px-8">
                        <div className="max-w-xl">
                          <p className="font-medium">{template.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {(template.content || "")
                              .replace(/<[^>]*>/g, " ")
                              .replace(/\s+/g, " ")
                              .trim()
                              .slice(0, 90) || "No content added yet"}
                            {(template.content || "")
                              .replace(/<[^>]*>/g, " ")
                              .replace(/\s+/g, " ")
                              .trim().length > 90
                              ? "..."
                              : ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-600">
                        {new Date(template.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setTemplateToDelete(template)}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
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
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Template editor
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                    {editingId ? "Edit Template" : "Create Template"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Build reusable agreement content with smart variable
                    placeholders.
                  </p>
                </div>
              <button
                onClick={handleCloseModal}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:text-slate-600"
              >
                  ✕
              </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-8">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, name: e.target.value })
                  }
                  placeholder="e.g., Service Agreement"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-black shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="mt-5 flex flex-1 flex-col">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                    Content
                  </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Use variables to personalize documents when the template
                      is loaded.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                    Click any variable to insert it into the editor.
                  </div>
                </div>

                {/* Dynamic Variables Buttons */}
                <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {dynamicVariables.map((variable) => (
                    <button
                      key={variable.value}
                      onClick={() => {
                        setNewTemplate({
                          ...newTemplate,
                          content: newTemplate.content + variable.value,
                        });
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      + {variable.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-1 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
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
            <div className="flex gap-3 border-t border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-6">
              <button
                onClick={handleSaveTemplate}
                disabled={saving || !newTemplate.name.trim()}
                className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Template"
                    : "Create Template"}
              </button>
              <button
                onClick={handleCloseModal}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
