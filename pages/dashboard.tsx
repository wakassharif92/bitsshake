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

  return (
    <div className="min-h-screen bg-gray-50">
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
      <header className=" ">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex justify-center">
          <nav className="hidden lg:flex items-center gap-x-10 font-inria rounded-full px-8 py-4 bg-gradient-to-b from-[#ffffff] to-[#d9d9d9] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),_0_8px_20px_rgba(0,0,0,0.15)] border border-white/80">
            <Link
              href="/dashboard#documents"
              className="flex items-center gap-3 pr-2 group"
            >
              <Image
                src="/bitsshake-logo2.png"
                alt="BitsShake Logo"
                width={50}
                height={50}
                className="object-contain"
              />
              {/* <span className="text-gray-500">•</span> */}
              {/* <span className="text-sm font-medium text-gray-300">
              {user?.company_name || "Company"}
              </span> */}
            </Link>
            {navLinks.map((link) => {
              const isActive = router.asPath === link.path;
              return (
                <Link
                  key={link.name}
                  href={link.path}
                  className="flex items-center group"
                >
                  <span
                    className={`mr-1.5 transition-all duration-300 ${
                      isActive
                        ? "text-gray-900"
                        : "text-gray-600 group-hover:text-gray-900"
                    }`}
                  >
                    {link.icon}
                  </span>
                  <span
                    className={`text-sm font-medium tracking-wide transition-all duration-300 ${
                      isActive
                        ? "text-gray-900"
                        : "text-gray-600 group-hover:text-gray-900"
                    }`}
                  >
                    {link.name}
                  </span>
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              disabled={signOutLoading}
              className="flex items-center group"
              type="button"
            >
              <span
                className={`text-sm font-medium tracking-wide transition-all duration-300 ${
                  signOutLoading
                    ? "text-gray-400"
                    : "text-gray-600 group-hover:text-gray-900"
                }`}
              >
                {signOutLoading ? "Signing out..." : "Sign out"}
              </span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Documents section */}
        <div
          id="documents"
          className="bg-white shadow rounded-lg overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">My Documents</h2>
          </div>

          {documents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 mb-4 ">No documents yet</p>
              <Link href="/documents/create">
                <button className="px-8 py-2.5 rounded-full text-[15px] font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02]">
                  Create your first document
                </button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
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
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {doc.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold capitalize ${
                            doc.status === "draft"
                              ? "bg-yellow-200 text-yellow-900"
                              : doc.status === "sent"
                                ? "bg-blue-200 text-blue-900"
                                : doc.status === "completed"
                                  ? "bg-green-900 text-green-100"
                                  : doc.status === "revert"
                                    ? "bg-orange-200 text-orange-900"
                                  : doc.status === "signed"
                                    ? "bg-green-200 text-green-900"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        {(doc.status === "draft" || doc.status === "revert") && (
                          <>
                            <Link href={`/documents/${doc.id}/edit`}>
                              <button className="px-4 py-1.5 rounded-full text-sm font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02]">
                                Edit
                              </button>
                            </Link>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="px-4 py-1.5 rounded-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-all duration-300 ease-out hover:scale-[1.02]"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {doc.status !== "draft" && doc.status !== "revert" && (
                          <Link href={`/documents/${doc.id}/view`}>
                            <button className="px-4 py-1.5 rounded-full text-sm font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02]">
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
