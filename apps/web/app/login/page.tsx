"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Redirect if already logged in
    const checkUser = async () => {
      if (!supabaseBrowser) return;
      const { data } = await supabaseBrowser.auth.getSession();
      if (data.session) {
        router.push("/");
      }
    };
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseBrowser) {
      setError("System configuration missing (Supabase credentials).");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    if (!supabaseBrowser) {
      setError("System configuration missing.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccessMsg("Password reset link sent to your email!");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0c] overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03]" 
             style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative z-10 hidden flex-1 lg:flex flex-col justify-center px-12 xl:px-24 bg-gradient-to-br from-black/40 to-transparent border-r border-white/5">
        <div className="max-w-lg">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Enterprise Platform</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-black text-white leading-tight mb-6 tracking-tighter">
            Welcome Back to <br/>
            <span className="bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-500 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">SheetToPages.</span>
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-md">
            The world's fastest way to turn raw spreadsheet data into globally distributed excellence.
          </p>
          
          <div className="grid grid-cols-2 gap-6 mt-12">
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl font-bold text-white mb-1 tracking-tight">100ms</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Edge Latency</div>
            </div>
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl font-bold text-white mb-1 tracking-tight">10k+</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Sites</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 relative">
        <div className="w-full max-w-[440px]">
          {/* Logo Mobile */}
          <div className="lg:hidden mb-12 flex justify-center">
             <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                <span className="font-black text-white">S2P</span>
             </div>
          </div>

          <div className="text-center lg:text-left mb-10">
            <h2 className="text-3xl font-black text-white mb-3">Sign In</h2>
            <p className="text-slate-500 font-medium">Access your enterprise dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 outline-none transition-all focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 hover:bg-white/[0.07]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
                <button 
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pr-12 text-white placeholder:text-slate-600 outline-none transition-all focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 hover:bg-white/[0.07]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <p className="text-sm font-bold text-rose-500 leading-tight">{error}</p>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <p className="text-sm font-bold text-emerald-500 leading-tight">{successMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full group relative flex items-center justify-center gap-3 bg-white text-black rounded-2xl py-5 text-sm font-black uppercase tracking-[0.1em] transition-all hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden mt-8 shadow-xl shadow-white/5"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  Connect Instance
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 transition-transform group-hover:translate-x-1">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-12 text-center text-slate-500 font-medium text-sm">
            Need an enterprise account?{" "}
            <Link href="/register" className="text-indigo-400 font-bold hover:text-white transition-colors underline underline-offset-4 decoration-indigo-500/30">
              Register Workspace
            </Link>
          </p>

          <div className="mt-16 pt-10 border-t border-white/5 flex flex-col gap-4">
            <div className="flex items-center gap-4 text-slate-600">
               <div className="h-px flex-1 bg-white/5" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verified Security</span>
               <div className="h-px flex-1 bg-white/5" />
            </div>
            <div className="flex justify-center gap-6 opacity-30 grayscale hover:grayscale-0 transition-all">
                {/* Minimal placeholder logos */}
                <div className="text-[10px] font-black tracking-tighter text-white">CLOUDFLARE</div>
                <div className="text-[10px] font-black tracking-tighter text-white">SUPABASE</div>
                <div className="text-[10px] font-black tracking-tighter text-white">VERCEL</div>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
