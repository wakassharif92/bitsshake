import { AlertCircle } from "lucide-react";

export default function DevelopmentBanner() {
  return (
    <div className="bg-black border-b-2 border-white-300 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <AlertCircle className="text-white-600 flex-shrink-0" size={20} />
        <div className="flex-1">
          <p className="text-white-800 text-sm">
            <strong>Development Mode:</strong> This website is currently in
            development and you might face some issues.{" "}
            <a
              href="mailto:hello@bitsoclock.com"
              className="font-semibold underline hover:text-yellow-900"
            >
              Please send an email to hello@bitsoclock.com
            </a>{" "}
            if you encounter any problems.
          </p>
        </div>
      </div>
    </div>
  );
}
