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
    if (!confirm("Delete this invoice?")) return;

    try {
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (error) throw error;
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId));
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to delete invoice");
      alert("Error deleting invoice: " + message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <button className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-black/80 transition-colors font-serif">
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
              <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
            </div>
            <button
              onClick={openCreateModal}
              className="font-serif px-8 py-2.5 rounded-full text-[15px] font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              Create Invoice
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {errorMessage ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg font-serif">
            {errorMessage}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {invoices.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500 mb-4 font-serif">No invoices yet</p>
                <button
                  onClick={openCreateModal}
                  className="font-serif px-8 py-2.5 rounded-full text-[15px] font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d]"
                >
                  Create your first invoice
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                        Remaining
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                        Actions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-serif">
                        Delete
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
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
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-serif">
                            {invoice.client_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-serif capitalize">
                            {invoice.invoice_type === "one_time"
                              ? "One Time"
                              : "Milestone"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-serif">
                            {invoice.currency} {totalAmount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-serif">
                            {invoice.currency} {remainingAmount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize bg-gray-100 text-gray-800">
                              {getInvoiceStatusLabel(invoice.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-serif">
                            {invoice.due_date
                              ? new Date(invoice.due_date).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-serif">
                            {new Date(invoice.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <Link href={`/invoices/${invoice.id}`}>
                              <button className="inline-flex items-center px-4 py-1.5 rounded-full bg-black text-white hover:bg-gray-800 font-serif">
                                View
                              </button>
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              className="inline-flex items-center px-4 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 font-serif"
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
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4 font-serif">
              Create Invoice
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-serif">
                  Payment Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInvoiceType("milestone")}
                    className={`px-4 py-3 rounded-lg border text-left font-serif transition-colors ${
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
                    className={`px-4 py-3 rounded-lg border text-left font-serif transition-colors ${
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-black font-serif"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black font-serif"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black font-serif"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black font-serif"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black font-serif"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-black font-serif"
                />
              </div>

              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
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
                      className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-gray-800 font-serif"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-black font-serif"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-black font-serif"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      {form.invoice_type === "milestone" && form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMilestoneItem(entry.id)}
                          className="w-full sm:w-auto px-2 py-2 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50 font-serif"
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

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreateInvoice}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 font-medium font-serif"
              >
                {saving ? "Creating..." : "Create Invoice"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-md hover:bg-gray-400 font-medium font-serif"
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
