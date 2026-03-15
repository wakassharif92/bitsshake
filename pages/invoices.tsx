import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Invoice } from "@/lib/types";

type InvoiceType = "one_time" | "milestone";

interface InvoiceItemForm {
  id: string;
  item: string;
  amount: string;
}

interface InvoiceMilestone {
  item?: string;
  amount?: number | string;
  sender_signature_text?: string;
  receiver_signature_text?: string;
}

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
};

const getInvoiceStatusLabel = (status?: string) => {
  if (!status) return "-";
  if (status === "draft") return "In Progress";
  return status.replace(/_/g, " ");
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    sender_signer_email: "",
    receiver_signer_email: "",
    description: "",
    currency: "USD",
    due_date: "",
    invoice_type: "one_time" as InvoiceType,
    items: [{ id: "1", item: "", amount: "" }] as InvoiceItemForm[],
  });

  const generateInvoiceNumber = () => {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate(),
    ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
      now.getMinutes(),
    ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    return `INV-${stamp}`;
  };

  const createEmptyItem = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    item: "",
    amount: "",
  });

  const totalAmount = useMemo(() => {
    return form.items.reduce((sum, entry) => {
      const n = Number(entry.amount || 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [form.items]);

  useEffect(() => {
    const fetchInvoices = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("admin_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        setInvoices([]);
      } else {
        setInvoices((data || []) as Invoice[]);
      }

      setLoading(false);
    };

    fetchInvoices();
  }, [router]);

  const openCreateModal = () => {
    setForm({
      client_name: "",
      client_email: "",
      sender_signer_email: "",
      receiver_signer_email: "",
      description: "",
      currency: "USD",
      due_date: "",
      invoice_type: "one_time",
      items: [createEmptyItem()],
    });
    setShowModal(true);
  };

  const setInvoiceType = (type: InvoiceType) => {
    setForm((prev) => {
      if (type === "one_time") {
        return {
          ...prev,
          invoice_type: type,
          items: prev.items.length > 0 ? [prev.items[0]] : [createEmptyItem()],
        };
      }
      return {
        ...prev,
        invoice_type: type,
        items: prev.items.length > 0 ? prev.items : [createEmptyItem()],
      };
    });
  };

  const updateItem = (id: string, field: "item" | "amount", value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    }));
  };

  const addMilestoneItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyItem()],
    }));
  };

  const removeMilestoneItem = (id: string) => {
    setForm((prev) => {
      const next = prev.items.filter((entry) => entry.id !== id);
      return {
        ...prev,
        items: next.length > 0 ? next : [createEmptyItem()],
      };
    });
  };

  const handleCreateInvoice = async () => {
    if (!form.client_name.trim()) {
      alert("Please fill Client Name.");
      return;
    }

    if (form.items.length === 0) {
      alert("Please add at least one item.");
      return;
    }

    const normalizedItems = form.items.map((entry) => ({
      item: entry.item.trim(),
      amount: Number(entry.amount),
    }));

    const invalidItem = normalizedItems.find(
      (entry) => !entry.item || Number.isNaN(entry.amount) || entry.amount <= 0,
    );

    if (invalidItem) {
      alert("Each item needs a name and amount greater than 0.");
      return;
    }

    if (form.invoice_type === "one_time" && normalizedItems.length !== 1) {
      alert("One-time payment supports only one item.");
      return;
    }

    const total = normalizedItems.reduce((sum, entry) => sum + entry.amount, 0);

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const payload = {
        admin_id: session.user.id,
        invoice_number: generateInvoiceNumber(),
        client_name: form.client_name.trim(),
        client_email: form.client_email.trim() || null,
        sender_signer_email: form.sender_signer_email.trim() || null,
        receiver_signer_email: form.receiver_signer_email.trim() || null,
        description: form.description.trim() || null,
        invoice_type: form.invoice_type,
        milestones: normalizedItems,
        total_amount: total,
        amount: total,
        currency: form.currency.trim().toUpperCase(),
        due_date: form.due_date || null,
        status: "in_progress" as Invoice["status"],
      };

      const { data, error } = await supabase
        .from("invoices")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setInvoices((prev) => [data as Invoice, ...prev]);
      setShowModal(false);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to create invoice");
      alert("Error creating invoice: " + message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      setDeletingInvoice(true);
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (error) throw error;
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId));
      setInvoiceToDelete(null);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to delete invoice");
      alert("Error deleting invoice: " + message);
    } finally {
      setDeletingInvoice(false);
    }
  };

  const totalInvoices = invoices.length;
  const totalOutstanding = invoices.reduce((sum, invoice) => {
    const milestones = Array.isArray(invoice.milestones)
      ? (invoice.milestones as InvoiceMilestone[])
      : [];
    const completedAmount = milestones.reduce((innerSum, milestone) => {
      const isFullySigned =
        !!(milestone.sender_signature_text || "").trim() &&
        !!(milestone.receiver_signature_text || "").trim();
      if (!isFullySigned) return innerSum;
      const value = Number(milestone.amount || 0);
      return innerSum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
    return sum + Math.max(total - completedAmount, 0);
  }, 0);
  const inProgressCount = invoices.filter(
    (invoice) => invoice.status === "draft" || invoice.status === "in_progress",
  ).length;
  const completedCount = invoices.filter(
    (invoice) => invoice.status === "completed" || invoice.status === "received",
  ).length;

  const getInvoiceStatusClasses = (status?: string) => {
    if (status === "completed") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (status === "received") {
      return "border-sky-200 bg-sky-50 text-sky-700";
    }
    if (status === "draft" || status === "in_progress") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-slate-200 bg-slate-100 text-slate-700";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      {invoiceToDelete && (
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
                Delete Invoice?
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                <span className="font-medium text-slate-900">
                  {invoiceToDelete.client_name}
                </span>{" "}
                will be removed permanently.
              </p>
              <div className="mt-6 flex w-full gap-3">
                <button
                  onClick={() => setInvoiceToDelete(null)}
                  disabled={deletingInvoice}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteInvoice(invoiceToDelete.id)}
                  disabled={deletingInvoice}
                  className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {deletingInvoice ? "Deleting..." : "Delete"}
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
                    Invoices
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Billing workspace
                  </span>
                </div>
                <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] text-slate-950 sm:text-4xl">
                  Invoice Library
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Manage one-time and milestone invoices, track outstanding
                  balances, and open signature flows from one place.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Total invoices
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {totalInvoices}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Saved to your account
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      In progress
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {inProgressCount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Awaiting signatures
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Completed
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {completedCount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Finalized invoices
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Create Invoice
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {errorMessage ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            {errorMessage}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Library
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    Saved Invoices
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review balances, status, and signature progress at a glance.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                  {totalOutstanding > 0
                    ? `${totalOutstanding.toFixed(2)} total outstanding across invoices`
                    : "All tracked invoice balances are settled"}
                </div>
              </div>
            </div>
            {invoices.length === 0 ? (
              <div className="px-6 py-16 text-center sm:px-8">
                <div className="mx-auto max-w-xl rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Empty library
                  </p>
                  <h3 className="mt-4 text-2xl font-semibold text-slate-900">
                    No invoices yet
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                    Create your first invoice to start managing one-time or
                    milestone billing flows.
                  </p>
                  <button
                    onClick={openCreateModal}
                    className="mt-8 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Create Your First Invoice
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="border-b border-slate-200 bg-slate-50/80">
                    <tr>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-8">
                        Client
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Remaining
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Due Date
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Created
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Actions
                      </th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Delete
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((invoice) => {
                      const totalAmount = Number(
                        invoice.total_amount ?? invoice.amount ?? 0,
                      ).toFixed(2);
                      const milestones = Array.isArray(invoice.milestones)
                        ? (invoice.milestones as InvoiceMilestone[])
                        : [];
                      const completedAmount = milestones.reduce((sum, milestone) => {
                        const isFullySigned =
                          !!(milestone.sender_signature_text || "").trim() &&
                          !!(milestone.receiver_signature_text || "").trim();
                        if (!isFullySigned) return sum;
                        const value = Number(milestone.amount || 0);
                        return sum + (Number.isFinite(value) ? value : 0);
                      }, 0);
                      const remainingAmount = Math.max(
                        Number(invoice.total_amount ?? invoice.amount ?? 0) -
                          completedAmount,
                        0,
                      ).toFixed(2);
                      return (
                        <tr key={invoice.id} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-6 py-5 text-sm text-slate-700 sm:px-8">
                            <div className="max-w-xs">
                              <p className="font-medium text-slate-900">
                                {invoice.client_name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {invoice.invoice_number || "Invoice"}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-700 capitalize">
                            {invoice.invoice_type === "one_time"
                              ? "One Time"
                              : "Milestone"}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-700">
                            {invoice.currency} {totalAmount}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-700">
                            {invoice.currency} {remainingAmount}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getInvoiceStatusClasses(invoice.status)}`}>
                              {getInvoiceStatusLabel(invoice.status)}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-700">
                            {invoice.due_date
                              ? new Date(invoice.due_date).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-600">
                            {new Date(invoice.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm">
                            <Link href={`/invoices/${invoice.id}`}>
                              <button className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                                View
                              </button>
                            </Link>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm">
                            <button
                              onClick={() => setInvoiceToDelete(invoice)}
                              className="inline-flex items-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Invoice editor
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                Create Invoice
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Configure billing structure, recipients, due date, and milestone
                breakdown before sharing.
              </p>
            </div>

            <div className="space-y-5 p-6 sm:p-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInvoiceType("milestone")}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      form.invoice_type === "milestone"
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    Milestone Type
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceType("one_time")}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      form.invoice_type === "one_time"
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    One Time Payment
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={form.client_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, client_name: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-black shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                    Client Email
                  </label>
                  <input
                    type="email"
                    value={form.client_email}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, client_email: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-black shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                    Sender Signer Email
                  </label>
                  <input
                    type="email"
                    value={form.sender_signer_email}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sender_signer_email: e.target.value,
                      }))
                    }
                    placeholder="sender@example.com"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-black shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                    Receiver Signer Email
                  </label>
                  <input
                    type="email"
                    value={form.receiver_signer_email}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        receiver_signer_email: e.target.value,
                      }))
                    }
                    placeholder="receiver@example.com"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-black shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, due_date: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-black shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, currency: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black font-serif"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-serif">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-black shadow-sm"
                />
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 font-serif">
                    {form.invoice_type === "milestone"
                      ? "Milestone List"
                      : "Payment Item"}
                  </p>
                  {form.invoice_type === "milestone" && (
                    <button
                      type="button"
                      onClick={addMilestoneItem}
                    className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      + Add Item
                    </button>
                  )}
                </div>

                {form.items.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <div className="sm:col-span-7">
                      <input
                        type="text"
                        value={entry.item}
                        onChange={(e) =>
                          updateItem(entry.id, "item", e.target.value)
                        }
                        placeholder={
                          form.invoice_type === "milestone"
                            ? `Milestone ${index + 1} item`
                            : "Payment item"
                        }
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-black shadow-sm"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.amount}
                        onChange={(e) =>
                          updateItem(entry.id, "amount", e.target.value)
                        }
                        placeholder="Amount"
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-black shadow-sm"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      {form.invoice_type === "milestone" && form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMilestoneItem(entry.id)}
                          className="w-full rounded-2xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 sm:w-auto"
                        >
                          X
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-700 font-serif">
                    {form.invoice_type === "milestone"
                      ? `Total Milestones: ${form.items.length}`
                      : "One Time Payment"}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 font-serif">
                    Total: {form.currency.toUpperCase()} {totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-6">
              <button
                onClick={handleCreateInvoice}
                disabled={saving}
                className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Invoice"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
