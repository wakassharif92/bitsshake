import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("Reset link is invalid or expired. Please request a new one.");
      }
    };

    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess("Password updated. You can sign in now.");
      setTimeout(() => router.push("/login"), 1200);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-serif">
      <div className="max-w-md w-full space-y-6">
        <div>
          <Image
            src="/bitsshake-logo.png"
            alt="BitsShake Logo"
            width={200}
            height={100}
            className="mx-auto"
          />
          <p className="text-center text-sm text-gray-600">
            Reset your password
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleReset}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
          )}

          <input
            type="password"
            placeholder="New password"
            className="appearance-none relative block w-full px-4 py-3 border-2 border-white/80 bg-white/80 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-0 focus:border-white sm:text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            className="appearance-none relative block w-full px-4 py-3 border-2 border-white/80 bg-white/80 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-0 focus:border-white sm:text-sm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className="group flex items-center justify-between w-full max-w-xs px-5 py-3 rounded-full bg-gray-100 transition-transform duration-200 ease-out hover:scale-105 disabled:opacity-50 border-2 border-white cursor-pointer"
            >
              <span className="text-gray-800 text-sm font-medium">
                {loading ? "Updating..." : "Update password"}
              </span>
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 text-white">
                {loading ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                ) : (
                  "→"
                )}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
