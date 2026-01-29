import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";

export default function AdminGate() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if user already passed the gate
  useEffect(() => {
    const gateToken = localStorage.getItem("ehandshake_gate_token");
    if (gateToken === "passed") {
      router.push("/login");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Fetch admin credentials from config
      const { data: configData } = await supabase
        .from("config")
        .select("key, value")
        .in("key", ["admin_username", "admin_password"]);

      const config: Record<string, string> = {};
      configData?.forEach((item) => {
        config[item.key] = item.value;
      });

      // Check credentials
      if (
        username === config.admin_username &&
        password === config.admin_password
      ) {
        // Set gate token and redirect
        localStorage.setItem("ehandshake_gate_token", "passed");
        router.push("/login");
      } else {
        setError("Invalid username or password");
      }
    } catch (err: any) {
      setError("Error verifying credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">BitsShake</h1>
          <p className="text-gray-600">Admin Access Required</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              placeholder="Enter admin username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Access BitsShake"}
          </button>
        </form>

        <div className="mt-8 p-4 bg-blue-50 rounded-md">
          <p className="text-xs text-gray-600">
            <strong>Demo credentials:</strong>
            <br />
            Username: admin
            <br />
            Password: ehandshake123
          </p>
        </div>
      </div>
    </div>
  );
}
