import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Document, User } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [signOutLoading, setSignOutLoading] = useState(false);

  const fetchDocuments = async (userId: string) => {
    const { data: docsData } = await supabase
      .from("documents")
      .select("*")
      .eq("admin_id", userId)
      .order("created_at", { ascending: false });

    setDocuments(docsData || []);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      // Fetch user data
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      setUser(userData);

      // Fetch documents
      await fetchDocuments(session.user.id);
      setLoading(false);

      // Poll for document updates every 3 seconds
      const pollInterval = setInterval(() => {
        fetchDocuments(session.user.id);
      }, 3000);

      // Refresh documents when page comes back into focus
      const handleFocus = async () => {
        await fetchDocuments(session.user.id);
      };

      window.addEventListener("focus", handleFocus);

      return () => {
        clearInterval(pollInterval);
        window.removeEventListener("focus", handleFocus);
      };
    };

    const cleanup = checkAuth();
    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, [router]);

  const handleSignOut = async () => {
    setSignOutLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    await supabase.from("documents").delete().eq("id", id);
    setDocuments(documents.filter((d) => d.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">BitsShake</h1>
            <p className="text-sm text-gray-600 mt-1">
              Welcome, {user?.full_name} ({user?.company_name})
            </p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signOutLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {signOutLoading ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Action buttons */}
        <div className="mb-8 flex gap-4">
          <Link href="/documents/create">
            <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
              Create Document
            </button>
          </Link>
          <Link href="/templates">
            <button className="px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium">
              Manage Templates
            </button>
          </Link>
        </div>

        {/* Documents section */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">My Documents</h2>
          </div>

          {documents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 mb-4">No documents yet</p>
              <Link href="/documents/create">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
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
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            doc.status === "draft"
                              ? "bg-yellow-100 text-yellow-800"
                              : doc.status === "sent"
                                ? "bg-blue-100 text-blue-800"
                                : doc.status === "signed"
                                  ? "bg-green-100 text-green-800"
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
                        {doc.status === "draft" && (
                          <>
                            <Link href={`/documents/${doc.id}/edit`}>
                              <button className="text-blue-600 hover:text-blue-800">
                                Edit
                              </button>
                            </Link>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {doc.status !== "draft" && (
                          <Link href={`/documents/${doc.id}/view`}>
                            <button className="text-blue-600 hover:text-blue-800">
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
