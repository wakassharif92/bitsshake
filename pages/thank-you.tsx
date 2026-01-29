import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function ThankYou() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home after 5 seconds
    const timer = setTimeout(() => {
      router.push("/");
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white shadow rounded-lg p-8">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            Your document has been signed successfully. You will be redirected
            shortly.
          </p>
          <Link href="/">
            <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Go Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
