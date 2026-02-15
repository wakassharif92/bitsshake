import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<
    "google" | "apple" | null
  >(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [switchAccountLoading, setSwitchAccountLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setCheckingSession(false);
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (userData) {
        router.push("/dashboard");
        return;
      }

      setProfileEmail(session.user.email || "");
      setProfileName(session.user.user_metadata?.full_name || "");
      setShowProfileSetup(true);
      setCheckingSession(false);
    };

    checkSession();
  }, [router]);
  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    setError("");
    setLoading(true);
    setLoadingProvider(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleProfileSave = async () => {
    if (!profileName.trim() || !profileCompany.trim() || !profileEmail.trim()) {
      setError("Please enter full name and company name.");
      return;
    }

    setProfileSaving(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Session expired. Please sign in again.");
        setProfileSaving(false);
        return;
      }

      // Calculate trial dates
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setMonth(trialEnd.getMonth() + 1);

      const { error } = await supabase.from("users").insert([
        {
          id: session.user.id,
          email: profileEmail.trim(),
          full_name: profileName.trim(),
          company_name: profileCompany.trim(),
          role: "admin",
          trial_start_at: now.toISOString(),
          trial_end_at: trialEnd.toISOString(),
        },
      ]);

      if (error) throw error;

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSwitchAccount = async () => {
    setSwitchAccountLoading(true);
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } finally {
      setSwitchAccountLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-serif">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/60 border-t-white" />
      </div>
    );
  }

  if (showProfileSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-serif relative">
        <div className="max-w-md w-full space-y-6">
          <div className="absolute top-6 right-6">
            <button
              type="button"
              onClick={handleSwitchAccount}
              disabled={switchAccountLoading}
              className="px-8 py-2.5 rounded-full text-[15px] font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                {switchAccountLoading && (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                )}
                {switchAccountLoading ? "Switching..." : "Switch account"}
              </span>
            </button>
          </div>
          <div>
            <Image
              src="/bitsshake-logo.png"
              alt="BitsShake Logo"
              width={200}
              height={100}
              className="mx-auto"
            />
            <p className="text-center text-sm text-gray-600">
              Complete your profile to continue
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <input
              type="email"
              value={profileEmail}
              readOnly
              className="appearance-none relative block w-full px-4 py-3 border-2 border-white/80 bg-white/80 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-0 focus:border-white sm:text-sm"
            />
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
              disabled={profileSaving}
              className="group flex items-center justify-between w-full max-w-xs px-5 py-3 rounded-full bg-gray-100 transition-transform duration-200 ease-out hover:scale-105 disabled:opacity-50 border-2 border-white cursor-pointer"
            >
              <span className="text-gray-800 text-sm font-medium">
                {profileSaving ? "Saving..." : "Continue"}
              </span>
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 text-white">
                {profileSaving ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-serif">
      <div className="max-w-md w-full space-y-1">
        <div>
          <Image
            src="/bitsshake-logo2.png"
            alt="BitsShake Logo"
            width={200}
            height={100}
            className="mx-auto"
          />
          <p className=" text-center text-sm text-gray-600">
            Sign in to use Bits Shake
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => handleOAuthSignIn("google")}
                disabled={loading}
                className="group flex items-center justify-between w-full max-w-xs px-5 py-3 rounded-full bg-gray-100 transition-transform duration-200 ease-out hover:scale-105 disabled:opacity-50 border-2 border-white cursor-pointer"
              >
                <span className="text-gray-800 text-sm font-medium">
                  {loadingProvider === "google"
                    ? "Connecting..."
                    : "Continue with Google"}
                </span>
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 text-white">
                  {loadingProvider === "google" ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
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

            {/* <div className="flex justify-center">
              <button
                type="button"
                onClick={() => handleOAuthSignIn("apple")}
                disabled={loading}
                className="group flex items-center justify-between w-full max-w-xs px-5 py-3 rounded-full bg-gray-100 transition-transform duration-200 ease-out hover:scale-105 disabled:opacity-50 border-2 border-white cursor-pointer"
              >
                <span className="text-gray-800 text-sm font-medium">
                  {loadingProvider === "apple"
                    ? "Connecting..."
                    : "Continue with Apple"}
                </span>
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 text-white">
                  {loadingProvider === "apple" ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
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
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
