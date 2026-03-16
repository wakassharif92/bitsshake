// import { useEffect, useState } from "react";
// import { useRouter } from "next/router";
// import { supabase } from "@/lib/supabase";
// import Image from "next/image";

// export default function Login() {
//   const router = useRouter();
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [loadingProvider, setLoadingProvider] = useState<
//     "google" | "apple" | null
//   >(null);
//   const [checkingSession, setCheckingSession] = useState(true);
//   const [showProfileSetup, setShowProfileSetup] = useState(false);
//   const [profileName, setProfileName] = useState("");
//   const [profileCompany, setProfileCompany] = useState("");
//   const [profileEmail, setProfileEmail] = useState("");
//   const [profileSaving, setProfileSaving] = useState(false);
//   const [switchAccountLoading, setSwitchAccountLoading] = useState(false);

//   useEffect(() => {
//     const checkSession = async () => {
//       const {
//         data: { session },
//       } = await supabase.auth.getSession();

//       if (!session) {
//         setCheckingSession(false);
//         return;
//       }

//       const { data: userData } = await supabase
//         .from("users")
//         .select("*")
//         .eq("id", session.user.id)
//         .single();

//       if (userData) {
//         router.push("/dashboard");
//         return;
//       }

//       setProfileEmail(session.user.email || "");
//       setProfileName(session.user.user_metadata?.full_name || "");
//       setShowProfileSetup(true);
//       setCheckingSession(false);
//     };

//     checkSession();
//   }, [router]);
//   const handleOAuthSignIn = async (provider: "google" | "apple") => {
//     setError("");
//     setLoading(true);
//     setLoadingProvider(provider);
//     try {
//       const { error } = await supabase.auth.signInWithOAuth({
//         provider,
//         options: {
//           redirectTo: `${window.location.origin}/login`,
//         },
//       });

//       if (error) throw error;
//     } catch (err: any) {
//       setError(err.message || "Failed to sign in");
//       setLoading(false);
//       setLoadingProvider(null);
//     }
//   };

//   const handleProfileSave = async () => {
//     if (!profileName.trim() || !profileCompany.trim() || !profileEmail.trim()) {
//       setError("Please enter full name and company name.");
//       return;
//     }

//     setProfileSaving(true);
//     setError("");
//     try {
//       const {
//         data: { session },
//       } = await supabase.auth.getSession();

//       if (!session) {
//         setError("Session expired. Please sign in again.");
//         setProfileSaving(false);
//         return;
//       }

//       // Calculate trial dates
//       const now = new Date();
//       const trialEnd = new Date(now);
//       trialEnd.setMonth(trialEnd.getMonth() + 1);

//       const { error } = await supabase.from("users").insert([
//         {
//           id: session.user.id,
//           email: profileEmail.trim(),
//           full_name: profileName.trim(),
//           company_name: profileCompany.trim(),
//           role: "admin",
//           trial_start_at: now.toISOString(),
//           trial_end_at: trialEnd.toISOString(),
//         },
//       ]);

//       if (error) throw error;

//       router.push("/dashboard");
//     } catch (err: any) {
//       setError(err.message || "Failed to save profile");
//     } finally {
//       setProfileSaving(false);
//     }
//   };

//   const handleSwitchAccount = async () => {
//     setSwitchAccountLoading(true);
//     try {
//       await supabase.auth.signOut();
//       window.location.href = "/login";
//     } finally {
//       setSwitchAccountLoading(false);
//     }
//   };

//   if (checkingSession) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-helvetica-neue">
//         <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/60 border-t-white" />
//       </div>
//     );
//   }

//   if (showProfileSetup) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-helvetica-neue relative">
//         <div className="max-w-md w-full space-y-6">
//           <div className="absolute top-6 right-6">
//             <button
//               type="button"
//               onClick={handleSwitchAccount}
//               disabled={switchAccountLoading}
//               className="px-8 py-2.5 rounded-full text-[15px] font-medium text-white bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_3px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-50"
//             >
//               <span className="flex items-center gap-2">
//                 {switchAccountLoading && (
//                   <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
//                 )}
//                 {switchAccountLoading ? "Switching..." : "Switch account"}
//               </span>
//             </button>
//           </div>
//           <div>
//             <Image
//               src="/bitsshake-logo.png"
//               alt="BitsShake Logo"
//               width={200}
//               height={100}
//               className="mx-auto"
//             />
//             <p className="text-center text-sm text-gray-600">
//               Complete your profile to continue
//             </p>
//           </div>

//           {error && (
//             <div className="rounded-md bg-red-50 p-4">
//               <p className="text-sm font-medium text-red-800">{error}</p>
//             </div>
//           )}

//           <div className="space-y-4">
//             <input
//               type="email"
//               value={profileEmail}
//               readOnly
//               className="appearance-none relative block w-full px-4 py-3 border-2 border-white/80 bg-white/80 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-0 focus:border-white sm:text-sm"
//             />
//             <input
//               type="text"
//               placeholder="Full name"
//               value={profileName}
//               onChange={(e) => setProfileName(e.target.value)}
//               className="appearance-none relative block w-full px-4 py-3 border-2 border-white/80 bg-white/80 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-0 focus:border-white sm:text-sm"
//             />
//             <input
//               type="text"
//               placeholder="Company name"
//               value={profileCompany}
//               onChange={(e) => setProfileCompany(e.target.value)}
//               className="appearance-none relative block w-full px-4 py-3 border-2 border-white/80 bg-white/80 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-0 focus:border-white sm:text-sm"
//             />
//           </div>

//           <div className="flex justify-center">
//             <button
//               type="button"
//               onClick={handleProfileSave}
//               disabled={profileSaving}
//               className="group flex items-center justify-between w-full max-w-xs px-5 py-3 rounded-full bg-gray-100 transition-transform duration-200 ease-out hover:scale-105 disabled:opacity-50 border-2 border-white cursor-pointer"
//             >
//               <span className="text-gray-800 text-sm font-medium">
//                 {profileSaving ? "Saving..." : "Continue"}
//               </span>
//               <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 text-white">
//                 {profileSaving ? (
//                   <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
//                 ) : (
//                   <svg
//                     xmlns="http://www.w3.org/2000/svg"
//                     className="h-4 w-4"
//                     fill="none"
//                     viewBox="0 0 24 24"
//                     stroke="currentColor"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth={2}
//                       d="M9 5l7 7-7 7"
//                     />
//                   </svg>
//                 )}
//               </span>
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-helvetica-neue">
//       <div className="max-w-md w-full space-y-1">
//         <div>
//           <Image
//             src="/bitsshake-logo2.png"
//             alt="BitsShake Logo"
//             width={200}
//             height={100}
//             className="mx-auto"
//           />
//           <p className=" text-center text-sm text-gray-600">
//             Sign in to use Bits Shake
//           </p>
//         </div>

//         <div className="mt-8 space-y-6">
//           {error && (
//             <div className="rounded-md bg-red-50 p-4">
//               <p className="text-sm font-medium text-red-800">{error}</p>
//             </div>
//           )}
//           <div className="space-y-4">
//             <div className="flex justify-center">
//               <button
//                 type="button"
//                 onClick={() => handleOAuthSignIn("google")}
//                 disabled={loading}
//                 className="group flex items-center justify-between w-full max-w-xs px-5 py-3 rounded-full bg-gray-100 transition-transform duration-200 ease-out hover:scale-105 disabled:opacity-50 border-2 border-white cursor-pointer"
//               >
//                 <span className="text-gray-800 text-sm font-medium">
//                   {loadingProvider === "google"
//                     ? "Connecting..."
//                     : "Continue with Google"}
//                 </span>
//                 <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 text-white">
//                   {loadingProvider === "google" ? (
//                     <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
//                   ) : (
//                     <svg
//                       xmlns="http://www.w3.org/2000/svg"
//                       className="h-4 w-4"
//                       fill="none"
//                       viewBox="0 0 24 24"
//                       stroke="currentColor"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth={2}
//                         d="M9 5l7 7-7 7"
//                       />
//                     </svg>
//                   )}
//                 </span>
//               </button>
//             </div>

//             {/* <div className="flex justify-center">
//               <button
//                 type="button"
//                 onClick={() => handleOAuthSignIn("apple")}
//                 disabled={loading}
//                 className="group flex items-center justify-between w-full max-w-xs px-5 py-3 rounded-full bg-gray-100 transition-transform duration-200 ease-out hover:scale-105 disabled:opacity-50 border-2 border-white cursor-pointer"
//               >
//                 <span className="text-gray-800 text-sm font-medium">
//                   {loadingProvider === "apple"
//                     ? "Connecting..."
//                     : "Continue with Apple"}
//                 </span>
//                 <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 text-white">
//                   {loadingProvider === "apple" ? (
//                     <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
//                   ) : (
//                     <svg
//                       xmlns="http://www.w3.org/2000/svg"
//                       className="h-4 w-4"
//                       fill="none"
//                       viewBox="0 0 24 24"
//                       stroke="currentColor"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth={2}
//                         d="M9 5l7 7-7 7"
//                       />
//                     </svg>
//                   )}
//                 </span>
//               </button>
//             </div> */}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}

function AuthShell({
  children,
  showHelp = true,
  slides,
  currentSlide = 0,
  onNextSlide,
  onPrevSlide,
  slideDirection = "next",
}: {
  children: React.ReactNode;
  showHelp?: boolean;
  slides?: { heading: string; subtext: string; image: string }[];
  currentSlide?: number;
  onNextSlide?: () => void;
  onPrevSlide?: () => void;
  slideDirection?: "next" | "prev";
}) {
  return (
    <div className="min-h-screen bg-[#fbfbfb] px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-[1100px]">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          {/* Spacer (keeps layout similar to screenshot on desktop) */}
          <div className="hidden md:block" />
        </div>

        {/* Main grid */}
        <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
          {/* Left: form */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-[430px]">{children}</div>
          </div>

          {/* Right: hero card */}
          <div className="relative hidden md:block">
            {/* floating pill */}
            <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
              {/* <div className="rounded-full border border-black/10 bg-white px-6 py-2 text-sm font-medium text-black/80 shadow-sm">
                Free for personal use
              </div> */}
            </div>

            <div className="relative overflow-hidden rounded-[28px] bg-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  key={currentSlide}
                  src={slides?.[currentSlide]?.image || "/slide-1.png"}
                  alt="Auth slide"
                  fill
                  className={`object-cover ${slideDirection === "next" ? "animate-slideInRight" : "animate-slideInLeft"}`}
                  priority
                />
                {/* soft overlay for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                <div className="absolute bottom-20 left-10 right-10">
                  {slides && slides[currentSlide] && (
                    <>
                      <h2
                        className="text-2xl sm:text-4xl font-semibold leading-tight text-white opacity-0 animate-fadeInUp font-helvetica-neue"
                        style={{ animationDelay: "0.2s" }}
                      >
                        {slides[currentSlide].heading}
                      </h2>
                      <p
                        className="mt-4 text-sm sm:text-lg text-white/90 whitespace-pre-line opacity-0 animate-fadeInUp font-helvetica-neue leading-tight"
                        style={{ animationDelay: "0.4s" }}
                      >
                        {slides[currentSlide].subtext}
                      </p>
                    </>
                  )}
                </div>

                {/* Dots */}
                <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                  {slides &&
                    slides.map((_, index) => (
                      <span
                        key={index}
                        className={`h-2 w-2 rounded-full transition-all ${
                          index === currentSlide ? "bg-white/90" : "bg-white/40"
                        }`}
                      />
                    ))}
                </div>

                {/* Arrows */}
                <button
                  type="button"
                  onClick={onPrevSlide}
                  className="absolute bottom-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-black shadow-sm hover:bg-white transition-colors"
                  aria-label="Previous"
                >
                  {/* Back icon (left arrow) */}
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onNextSlide}
                  className="absolute bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-black shadow-sm hover:bg-white transition-colors"
                  aria-label="Next"
                >
                  {/* Forward icon (right arrow) */}
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
                </button>
              </div>
            </div>

            {showHelp && (
              <div className="mt-4 flex items-center gap-2 text-xs text-black/60">
                <span className="inline-block h-4 w-4 rounded-full border border-black/20" />
                <span className="font-helvetica-neue">
                  hello@bitsoclock.com
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [switchAccountLoading, setSwitchAccountLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev">("next");

  const slides = [
    {
      heading: "Made for Freelancers & Startups",
      subtext:
        "Simple, fast, and professional agreements\nso you can focus on work, not paperwork.",
      image: "/slide-4.png",
    },
    {
      heading: "No Agreement. No Happy Ending.",
      subtext:
        "Misunderstandings, delayed payments,\nand broken expectations start without contracts.\n\nProtect every deal with a clear agreement.",
      image: "/slide-5.png",
    },
    {
      heading: "E-Signatures Without the High Price",
      subtext:
        "Professional document signing\nat a price freelancers and startups can actually afford.",
      image: "/slide-6.png",
    },
  ];

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

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideDirection("next");
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleNextSlide = () => {
    setSlideDirection("next");
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrevSlide = () => {
    setSlideDirection("prev");
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleOAuthSignIn = async () => {
    setError("");
    setLoading(true);
    setLoadingProvider("google");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
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
      <AuthShell showHelp={false}>
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-black/20 border-t-black" />
        </div>
      </AuthShell>
    );
  }

  // PROFILE SETUP (after OAuth, before user row exists)
  if (showProfileSetup) {
    return (
      <AuthShell
        slides={slides}
        currentSlide={currentSlide}
        onNextSlide={handleNextSlide}
        onPrevSlide={handlePrevSlide}
        slideDirection={slideDirection}
      >
        <div className="relative">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-[40px] font-semibold tracking-tight text-black/90">
              Complete profile
            </h1>
            <p className="mt-2 text-sm text-black/60">
              Let’s get you set up to start your 30 days free trial
            </p>
          </div>

          <div className="absolute right-0 top-0">
            <button
              type="button"
              onClick={handleSwitchAccount}
              disabled={switchAccountLoading}
              className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-medium text-black/80 shadow-sm hover:bg-black/[0.02] disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                {switchAccountLoading && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                )}
                {switchAccountLoading ? "Switching..." : "Switch account"}
              </span>
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold text-black/60">
                Email
              </label>
              <input
                type="email"
                value={profileEmail}
                readOnly
                className="w-full rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-black/80 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-black/60">
                Name
              </label>
              <input
                type="text"
                placeholder="Eg. Yasir Noori"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-black/90 outline-none focus:border-black/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-black/60">
                Company
              </label>
              <input
                type="text"
                placeholder="Your company name"
                value={profileCompany}
                onChange={(e) => setProfileCompany(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-black/90 outline-none focus:border-black/20"
              />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="w-full rounded-xl bg-[#0f3b2f] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-[1.02] disabled:opacity-60"
            >
              <span className="inline-flex items-center justify-center gap-2">
                {profileSaving && <Spinner />}
                {profileSaving ? "Saving..." : "Continue"}
              </span>
            </button>

            <p className="text-center text-xs text-black/45">
              By continuing, you agree to the Terms and Privacy Policy.
            </p>
          </div>
        </div>
      </AuthShell>
    );
  }

  // LOGIN
  return (
    <AuthShell
      slides={slides}
      currentSlide={currentSlide}
      onNextSlide={handleNextSlide}
      onPrevSlide={handlePrevSlide}
      slideDirection={slideDirection}
    >
      <div>
        <div className="mb-8">
          <Image
            src="/bitsshake-logo-4.png"
            alt="BitsShake Logo"
            width={300}
            height={300}
            className="mx-auto"
          />{" "}
          <h1 className="text-2xl sm:text-[40px] text-center font-semibold tracking-tight text-black/90 font-helvetica-neue">
            Welcome to Bits Shake
          </h1>
          <h3 className="text-center text-base sm:text-[15px] font-semibold tracking-tight text-black/90 font-helvetica-neue">
            The Most Affordable E-Signature You’ll Ever Need
          </h3>
          <p className="mt-2 text-sm text-black/60 text-center font-helvetica-neue">
            Continue with Google to access your dashboard
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleOAuthSignIn}
          disabled={loading}
          className="w-full rounded-xl bg-[#0f3b2f] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-[1.02] disabled:opacity-60"
        >
          <span className="inline-flex items-center justify-center gap-2 font-helvetica-neue">
            {loadingProvider === "google" && <Spinner />}
            {loadingProvider === "google"
              ? "Connecting..."
              : "Continue with Google"}
          </span>
        </button>

        {/* <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-3 w-full rounded-xl bg-[#d6ff7a] px-4 py-3 text-sm font-semibold text-black/80 shadow-sm hover:brightness-[0.98]"
        >
          Back to home
        </button> */}

        <p className="mt-6 text-center text-xs text-black/45 font-helvetica-neue">
          Trouble signing in? Contact support.
        </p>
      </div>
    </AuthShell>
  );
}
