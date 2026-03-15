import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Document, User } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [sessionUser, setSessionUser] = useState<{
    id: string;
    email: string | null;
    full_name?: string | null;
  } | null>(null);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const getTrialEnd = (userData: User | null) => {
    if (!userData) return null;
    if (userData.trial_end_at) return new Date(userData.trial_end_at);
    if (userData.created_at) {
      const created = new Date(userData.created_at);
      created.setDate(created.getDate() + 30);
      return created;
    }
    return null;
  };

  const trialEnd = getTrialEnd(user);
  const isTrialExpired = trialEnd ? trialEnd <= new Date() : false;

  const navLinks = [
    {
      name: "Write Document",
      path: "/documents/create",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      ),
    },
    {
      name: "Upload Document",
      path: "/documents/upload",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      ),
    },
    // { name: "Your Documents", path: "#documents" },
    {
      name: "Templates",
      path: isTrialExpired ? "/pricing" : "/templates",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      name: "Invoice",
      path: "/invoices",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 14h6m-6 4h6M7 4h10a2 2 0 012 2v12l-3-2-3 2-3-2-3 2V6a2 2 0 012-2z"
          />
        </svg>
      ),
    },
    {
      name: "Pricing",
      path: "/pricing",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  const fetchDocuments = async (sessionUserId: string) => {
    const { data: docsData } = await supabase
      .from("documents")
      .select("*")
      .eq("admin_id", sessionUserId)
      .order("created_at", { ascending: false });

    setDocuments(docsData || []);
  };

  const fetchUserData = async (userId: string) => {
    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userData) {
      setUser(userData);
    }

    return userData;
  };

  useEffect(() => {
    const checkAuth = async () => {
      let pollInterval: ReturnType<typeof setInterval> | null = null;
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setSessionUser({
        id: session.user.id,
        email: session.user.email || null,
        full_name: session.user.user_metadata?.full_name || null,
      });

      // Fetch user data
      const userData = await fetchUserData(session.user.id);

      if (!userData) {
        let pendingProfile: {
          full_name?: string;
          company_name?: string;
        } | null = null;
        try {
          const raw = localStorage.getItem("pendingProfile");
          pendingProfile = raw ? JSON.parse(raw) : null;
        } catch {
          pendingProfile = null;
        }

        setProfileName(
          pendingProfile?.full_name ||
            session.user.user_metadata?.full_name ||
            "",
        );
        setProfileCompany(pendingProfile?.company_name || "");
        setShowProfileSetup(true);
        setLoading(false);
        return;
      }

      await fetchDocuments(session.user.id);
      setLoading(false);

      pollInterval = setInterval(() => {
        fetchDocuments(session.user.id);
      }, 3000);

      const handleFocus = async () => {
        await fetchDocuments(session.user.id);
      };

      window.addEventListener("focus", handleFocus);

      return () => {
        if (pollInterval) clearInterval(pollInterval);
        window.removeEventListener("focus", handleFocus);
      };
    };

    const cleanup = checkAuth();
    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, [router]);

  const handleProfileSave = async () => {
    if (!sessionUser) return;
    if (!profileName.trim() || !profileCompany.trim()) return;

    setProfileSaving(true);
    try {
      const trialStart = new Date();
      const trialEnd = new Date();
      trialEnd.setMonth(trialEnd.getMonth() + 1);

      const { data: createdUser, error } = await supabase
        .from("users")
        .insert([
          {
            id: sessionUser.id,
            email: sessionUser.email,
            full_name: profileName.trim(),
            company_name: profileCompany.trim(),
            role: "admin",
            trial_start_at: trialStart.toISOString(),
            trial_end_at: trialEnd.toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setUser(createdUser);
      setShowProfileSetup(false);
      localStorage.removeItem("pendingProfile");

      await fetchDocuments(sessionUser.id);
    } catch (err) {
      console.error("Error creating user profile:", err);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleDeleteDocument = async (id: string) => {
    setDocumentToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    await supabase.from("documents").delete().eq("id", documentToDelete);
    setDocuments(documents.filter((d) => d.id !== documentToDelete));
    setShowDeleteModal(false);
    setDocumentToDelete(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (showProfileSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-serif">
        <div className="max-w-md w-full space-y-6">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signOutLoading}
              className="text-sm font-semibold text-black/80 hover:text-black/30 transition cursor-pointer"
            >
              {signOutLoading ? "Switching..." : "Switch account"}
            </button>
          </div>
          <div className="text-center">
            <Image
              src="/bitsshake-logo.png"
              alt="BitsShake Logo"
              width={200}
              height={100}
              className="mx-auto"
            />
            <p className="text-sm text-gray-600">
              Your account was not found. Please complete your profile.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Full name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="appearance-none relative block w-full px-4 py-3 border-2 border-white/80 bg-white/80 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-0 focus:border-white sm:text-sm"
            />
            <input
              type="text"
              placeholder="Company name"
              value={profileCompany}
              onChange={(e) => setProfileCompany(e.target.value)}
              className="appearance-none relative block w-full px-4 py-3 border-2 border-white/80 bg-white/80 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-0 focus:border-white sm:text-sm"
            />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleProfileSave}
              disabled={
                profileSaving || !profileName.trim() || !profileCompany.trim()
              }
              className="group flex items-center justify-between w-full max-w-xs px-5 py-3 rounded-full bg-gray-100 transition-transform duration-200 ease-out hover:scale-105 disabled:opacity-50 border-2 border-white cursor-pointer"
            >
              <span className="text-gray-800 text-sm font-medium">
                {profileSaving ? "Saving..." : "Continue"}
              </span>
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 text-white">
                {profileSaving ? (
                  <span className="h-4 w-4 rounded-full border-2 border-black/40 border-t-black animate-spin" />
                ) : (
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const draftCount = documents.filter((doc) => doc.status === "draft").length;
  const sentCount = documents.filter((doc) => doc.status === "sent").length;
  const completedCount = documents.filter(
    (doc) => doc.status === "completed" || doc.status === "signed",
  ).length;
  const recentDocument = documents[0] || null;

  const getStatusClasses = (status: string) => {
    if (status === "draft") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    if (status === "sent") {
      return "border-sky-200 bg-sky-50 text-sky-700";
    }
    if (status === "completed" || status === "signed") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (status === "revert") {
      return "border-rose-200 bg-rose-50 text-rose-700";
    }
    return "border-slate-200 bg-slate-100 text-slate-700";
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
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
              <h3 className="text-2xl font-semibold text-gray-900">
                Delete Document?
              </h3>
              <p className="text-gray-600">
                Are you sure you want to delete this document? This action
                cannot be undone.
              </p>
              <div className="flex gap-3 w-full mt-6">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDocumentToDelete(null);
                  }}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="hidden lg:flex items-center justify-between rounded-[32px] border border-white/80 bg-gradient-to-b from-white via-[#f8fafc] to-[#e9edf4] px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),_0_20px_50px_rgba(15,23,42,0.12)]">
            <Link
              href="/dashboard#documents"
              className="flex min-w-[230px] items-center gap-4"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Image
                  src="/bitsshake-logo2.png"
                  alt="BitsShake Logo"
                  width={42}
                  height={42}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Workspace
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {user?.company_name || "BitsShake"}
                </p>
                <p className="text-xs text-slate-500">
                  Document operations hub
                </p>
              </div>
            </Link>

            <nav className="mx-8 flex flex-1 items-center justify-center">
              <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 p-2 shadow-sm">
                {navLinks.map((link) => {
                  const isActive = router.asPath === link.path;
                  return (
                    <Link
                      key={link.name}
                      href={link.path}
                      className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-slate-950 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span
                        className={`transition-colors ${
                          isActive ? "text-white" : "text-slate-500"
                        }`}
                      >
                        {link.icon}
                      </span>
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="flex min-w-[190px] items-center justify-end gap-3">
              <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm xl:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Account
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {user?.full_name || sessionUser?.full_name || "Admin"}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signOutLoading}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-400"
                type="button"
              >
                {signOutLoading ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="mb-8 overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="bg-[linear-gradient(135deg,#f8fafc,white_50%,#eef2ff)] px-8 py-8 sm:px-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Dashboard
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    {user?.company_name || "Workspace"}
                  </span>
                </div>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-slate-950">
                  Your document workspace
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Create, send, and track agreements from one polished control
                  center. Recent activity and document health are visible at a
                  glance.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/documents/create">
                    <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                      Create New Document
                    </button>
                  </Link>
                  <Link href="/documents/upload">
                    <button className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                      Upload Existing File
                    </button>
                  </Link>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Total documents
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {documents.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Across all statuses
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Drafts
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {draftCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Ready for editing
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Awaiting action
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {sentCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Sent for signature
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Completed
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {completedCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Finalized agreements
                  </p>
                </div>
              </div>
            </div>
            {recentDocument && (
              <div className="mt-8 rounded-[24px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Most recent document
                </p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {recentDocument.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Created {new Date(recentDocument.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(recentDocument.status)}`}
                    >
                      {recentDocument.status}
                    </span>
                    <Link
                      href={
                        recentDocument.status === "draft" ||
                        recentDocument.status === "revert"
                          ? `/documents/${recentDocument.id}/edit`
                          : `/documents/${recentDocument.id}/view`
                      }
                    >
                      <button className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                        Open Document
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Documents section */}
        <div
          id="documents"
          className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
        >
          <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Library
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  My Documents
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Track progress, reopen drafts, and review completed files.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                {documents.length} total document{documents.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="px-6 py-16 text-center sm:px-8">
              <div className="mx-auto max-w-md rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10">
              <p className="mb-4 text-slate-500">No documents yet</p>
              <Link href="/documents/create">
                <button className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                  Create your first document
                </button>
              </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-8">
                      Title
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Status
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
                  {documents.map((doc) => (
                    <tr key={doc.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-5 text-sm font-medium text-slate-900 sm:px-8">
                        <div className="max-w-xl">
                          <p className="truncate font-medium">{doc.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {doc.status === "draft" || doc.status === "revert"
                              ? "Editable document"
                              : "Signature workflow in progress"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(doc.status)}`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-600">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm">
                        {(doc.status === "draft" || doc.status === "revert") && (
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/documents/${doc.id}/edit`}>
                              <button className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                                Edit
                              </button>
                            </Link>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                        {doc.status !== "draft" && doc.status !== "revert" && (
                          <Link href={`/documents/${doc.id}/view`}>
                            <button className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                              View
                            </button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
