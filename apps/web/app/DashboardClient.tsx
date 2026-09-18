"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { SampleSheetLink } from "../components/SampleSheetLink";

type Job = {
  id: string;
  status: string;
  message: string | null;
  total_sites: number;
  generated_sites: number;
  deployed_sites: number;
  created_at: string;
};

type Site = {
  id: string;
  row_index: number;
  title: string;
  domain: string | null;
  status: string;
  url: string | null;
  error: string | null;
};

function computeApiBase() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").trim();
  let apiBase = raw;
  let note: string | null = null;

  if (!/^https?:\/\//i.test(raw)) {
    apiBase = "http://localhost:4000";
    note = `Invalid NEXT_PUBLIC_API_BASE_URL="${raw}". It must start with http:// or https://`;
  } else {
    apiBase = raw.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    try {
      const apiUrl = new URL(apiBase);
      if (apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1") {
        if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
          apiUrl.hostname = window.location.hostname;
          apiBase = apiUrl.toString().replace(/\/+$/, "");
        }
      }
    } catch {}
  }

  return { apiBase, note };
}

const { apiBase, note: apiBaseNote } = computeApiBase();

type ConfigStatus = {
  supabase: {
    status: "ok" | "missing" | "placeholder" | "error" | "unknown";
    missingKeys: string[];
    project?: { host: string; ref: string | null } | null;
  };
  cloudflare: { status: "ok" | "missing" | "placeholder" | "error" | "unknown"; missingKeys: string[] };
  customDomains: { status: "ok" | "missing" | "placeholder" | "error" | "unknown" };
  googleOAuth?: {
    status: "ok" | "missing" | "placeholder" | "error" | "unknown";
    missingKeys: string[];
    clientId?: string | null;
    redirectUrl?: string | null;
  };
  googleSheets?: { status: "ok" | "missing" | "placeholder" | "error" | "unknown"; serviceAccountEmail: string | null };
  tablesStatus: "ok" | "missing" | "placeholder" | "error" | "unknown";
  tablesError: string | null;
  googleOAuthTokensTable?: { status: "ok" | "missing" | "placeholder" | "error" | "unknown"; error: string | null };
  nextSteps?: string[];
};

async function getAccessToken() {
  if (!supabaseBrowser) return null;
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session?.access_token ?? null;
}

export function DashboardClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"projects" | "deployments" | "settings">("projects");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [activeSites, setActiveSites] = useState<Site[]>([]);

  const [sheetUrl, setSheetUrl] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [configErr, setConfigErr] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);

  async function refreshConfig() {
    try {
      setConfigErr(null);
      const resp = await fetch(`${apiBase}/v1/config`);
      const raw = await resp.text();
      let json: ConfigStatus | null = null;
      try {
        json = raw ? (JSON.parse(raw) as ConfigStatus) : null;
      } catch {
        json = null;
      }
      if (!resp.ok || !json) {
        const msg = raw?.slice(0, 200) || `Failed to load API config (${resp.status})`;
        throw new Error(msg);
      }
      setConfig(json);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : `Failed to reach API at ${apiBase}. Set NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 and restart web.`;
      setConfig(null);
      setConfigErr(msg);
    }
  }

  useEffect(() => {
    if (!supabaseBrowser) {
      setSessionReady(true);
      setSignedIn(false);
      return;
    }

    const sub = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setSessionReady(true);
    });
    supabaseBrowser.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setSessionReady(true);
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    refreshConfig().catch(() => {});
    const t = setInterval(() => {
      refreshConfig().catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const authed = sessionReady && signedIn;
  const webSupabaseReady = Boolean(supabaseBrowser);
  const router = useRouter();

  useEffect(() => {
    if (sessionReady && !signedIn) {
      router.push("/login");
    }
  }, [sessionReady, signedIn, router]);
  const canRunJobs = webSupabaseReady && config?.supabase.status === "ok" && config?.tablesStatus === "ok";

  async function refreshJobs() {
    const token = await getAccessToken();
    if (!token) return;
    const resp = await fetch(`${apiBase}/v1/jobs`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error ?? "Failed to load jobs");
    setJobs(json.jobs ?? []);
  }

  async function deleteJob(jobId: string) {
    if (!confirm("Are you sure you want to delete this job history?")) return;
    const token = await getAccessToken();
    if (!token) return;
    const resp = await fetch(`${apiBase}/v1/jobs/${jobId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const json = await resp.json();
      throw new Error(json?.error ?? "Failed to delete job");
    }
    if (activeJobId === jobId) {
      setActiveJobId(null);
      setActiveJob(null);
      setActiveSites([]);
    }
    await refreshJobs();
  }

  async function refreshGoogleStatus() {
    const token = await getAccessToken();
    if (!token) return;
    const resp = await fetch(`${apiBase}/v1/google/status`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error ?? "Failed to load Google status");
    setGoogleConnected(Boolean(json.connected));
  }

  async function connectGoogle() {
    setErr(null);
    setSuccessMsg(null);
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");
    const resp = await fetch(`${apiBase}/v1/google/start`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error ?? "Failed to start Google connect");
    if (!json?.url) throw new Error("Missing Google auth URL");
    window.location.href = String(json.url);
  }

  async function disconnectGoogle() {
    setErr(null);
    setSuccessMsg(null);
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");
    const resp = await fetch(`${apiBase}/v1/google/disconnect`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error ?? "Failed to disconnect Google");
    setGoogleConnected(false);
  }

  async function refreshJob(jobId: string) {
    const token = await getAccessToken();
    if (!token) return;
    const resp = await fetch(`${apiBase}/v1/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error ?? "Failed to load job");
    setActiveJob(json.job);
    setActiveSites(json.sites ?? []);
  }

  useEffect(() => {
    if (!authed) return;
    refreshJobs().catch((e) => setErr(e instanceof Error ? e.message : "Failed to load jobs"));
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    refreshGoogleStatus().catch(() => setGoogleConnected(null));
  }, [authed]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const google = url.searchParams.get("google");
    const msg = url.searchParams.get("msg");
    if (google === "connected") {
      setSuccessMsg("Google connected. Now paste any private Google Sheet URL and click Generate & Deploy.");
      setErr(null);
      url.searchParams.delete("google");
      url.searchParams.delete("msg");
      window.history.replaceState({}, "", url.toString());
      void refreshGoogleStatus();
    } else if (google === "error") {
      setErr(msg ? `Google connect failed: ${msg}` : "Google connect failed");
      setSuccessMsg(null);
      url.searchParams.delete("google");
      url.searchParams.delete("msg");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (!activeJobId || !authed) return;
    let cancelled = false;

    const tick = async () => {
      try {
        await refreshJob(activeJobId);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to refresh job");
      }
    };

    void tick();
    const t = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeJobId, authed]);

  async function sendMagicLink() {
    if (!supabaseBrowser) {
      setAuthMsg("System configuration missing (Supabase credentials).");
      return;
    }
    setAuthMsg(null);
    setAuthLoading(true);
    try {
      const { error } = await supabaseBrowser.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setAuthMsg(error.message);
      else setAuthMsg("Check your email for a sign-in link.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signInWithPassword() {
    if (!supabaseBrowser) {
      setAuthMsg("System configuration missing (Supabase credentials).");
      return;
    }
    setAuthMsg(null);
    setAuthLoading(true);
    try {
      const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          setAuthMsg("Authentication failed. Please check your password or ensure your email is verified via the secure inbox link.");
        } else {
          setAuthMsg(error.message);
        }
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function signUpWithPassword() {
    if (!supabaseBrowser) {
      setAuthMsg("System configuration missing (Supabase credentials).");
      return;
    }
    setAuthMsg(null);
    setAuthLoading(true);
    try {
      const { data, error } = await supabaseBrowser.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setAuthMsg(error.message);
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        setAuthMsg("This email is already registered. Please sign in instead.");
      } else {
        setAuthMsg("Welcome! We've sent a secure verification link to your email. Please click it to activate your workspace.");
      }
    } catch (err: any) {
      setAuthMsg(err.message || "An unexpected error occurred during sign up.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    setJobs([]);
    setActiveJobId(null);
    setActiveJob(null);
    setActiveSites([]);
  }

  async function createJob() {
    setErr(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const file = fileRef.current?.files?.[0] ?? null;
      const hasUrl = sheetUrl.trim().length > 0;
      if (!file && !hasUrl) throw new Error("Select a file or paste a Google Sheet URL");

      const form = new FormData();
      if (file) form.append("file", file);
      if (hasUrl) form.append("sheetUrl", sheetUrl.trim());

      const resp = await fetch(`${apiBase}/v1/jobs/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const raw = await resp.text();
      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      if (!resp.ok) {
        const msg =
          (json && (json.error || json.message)) ||
          raw?.slice(0, 300) ||
          `Job creation failed (${resp.status})`;
        throw new Error(msg);
      }

      const jobId = json.jobId as string;
      setActiveJobId(jobId);
      await refreshJobs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Job creation failed";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  const progress = useMemo(() => {
    if (!activeJob) return null;
    const total = activeJob.total_sites || 0;
    const deployed = activeJob.deployed_sites || 0;
    const generated = activeJob.generated_sites || 0;
    return { total, generated, deployed };
  }, [activeJob]);

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c]">
        <div className="flex flex-col items-center gap-6">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-[0_0_20px_rgba(79,70,229,0.3)]" />
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Authenticating Instance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-indigo-500/30 selection:text-indigo-200 relative z-0">
      {/* Generated Background Image */}
      <div className="fixed inset-0 pointer-events-none z-[-3]" 
           style={{ 
             backgroundImage: 'url(/bg-hero.jpg)', 
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed',
             opacity: 0.35
           }} />
      
      {/* Vignette / Overlay to ensure text readability */}
      <div className="fixed inset-0 pointer-events-none z-[-2] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#0a0a0c]/70 to-[#0a0a0c]" />
      
      {/* Subtle Grid overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05] z-[-1]" 
           style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="relative mb-12">
          {/* Subtle top glow */}
          <div className="absolute inset-x-0 -top-12 -z-10 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent blur-2xl" />
          
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between rounded-[2rem] bg-[#131316]/80 p-3 pr-6 shadow-2xl shadow-black/50 ring-1 ring-white/5 backdrop-blur-xl border border-white/5 transition-all">
            <div className="flex items-center gap-5">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-b from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <div className="absolute inset-0 rounded-[1.5rem] bg-gradient-to-tr from-black/10 to-transparent" />
                <span className="relative font-mono text-2xl font-black text-white/90 drop-shadow-md">G&D</span>
                
                {/* Active status pulse */}
                <div className="absolute -top-1 -right-1 flex h-4 w-4 shrink-0 items-center justify-center">
                  <div className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></div>
                  <div className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] border border-emerald-200"></div>
                </div>
              </div>
              
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white group-hover:text-indigo-400">
                  Generate <span className="text-slate-500 mx-1 font-normal">&</span> Deploy
                </h1>
                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-indigo-400/80">
                  Enterprise Deployment Engine
                 </p>
              </div>
            </div>

            {/* Navigation & Search (Middle Section) */}
            <div className="hidden lg:flex items-center gap-8 flex-1 max-w-2xl mx-12">
              <nav className="flex items-center gap-6 shrink-0">
                <button 
                  onClick={() => setActiveTab("projects")}
                  className={`text-[13px] font-black uppercase tracking-wider transition-colors ${activeTab === 'projects' ? 'text-white' : 'text-slate-500 hover:text-white'}`}>Projects</button>
                <button 
                  onClick={() => setActiveTab("deployments")}
                  className={`text-[13px] font-black uppercase tracking-wider transition-colors ${activeTab === 'deployments' ? 'text-white' : 'text-slate-500 hover:text-white'}`}>Deployments</button>
                <button 
                  onClick={() => setActiveTab("settings")}
                  className={`text-[13px] font-black uppercase tracking-wider transition-colors ${activeTab === 'settings' ? 'text-white' : 'text-slate-500 hover:text-white'}`}>Settings</button>
              </nav>
              
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search resources..."
                  className="w-full bg-black/20 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder:text-slate-500 outline-none transition-all focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 hover:bg-white/[0.05]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t border-white/10 sm:border-0 pl-2 sm:pl-0 shrink-0">


              <button
                onClick={signOut}
                className="group relative flex items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-5 py-3 text-[11px] font-black uppercase tracking-wider text-rose-400 shadow-sm ring-1 ring-rose-500/20 transition-all hover:bg-rose-500 hover:text-white hover:shadow-lg hover:shadow-rose-500/20 active:scale-95"
              >
                Sign Out
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 opacity-60 transition-opacity group-hover:opacity-100">
                  <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-1.048a.75.75 0 1 0-1.06-1.06l-2.323 2.323a.25.25 0 0 0 0 .354l2.323 2.323a.75.75 0 1 0 1.06-1.06l-1.048-1.048h9.546A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {activeTab === "projects" && (
          <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <div className="group relative rounded-[2rem] border border-white/10 bg-[#131316] p-8 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all hover:border-white/20 hover:shadow-indigo-500/10">
              <div className="absolute -inset-0.5 rounded-[2rem] bg-gradient-to-r from-indigo-500/20 to-violet-500/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              
              <div className="relative flex items-start justify-between gap-6">
                <div>
                  <div className="text-2xl font-black text-white">Project</div>
                  <div className="mt-2 text-slate-400 font-medium max-w-md">
                    Seamlessly transform your spreadsheet data into professional, live websites on Cloudflare.
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    New Engine v2.0
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm ${
                    canRunJobs ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20" : "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                  }`}>
                    {canRunJobs ? "Ready" : "Action Required"}
                  </div>
                  <SampleSheetLink />
                </div>
              </div>



              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                <div className="group relative overflow-hidden rounded-[2.5rem] border-2 border-white/5 bg-[#1a1a1f] p-8 transition-all hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/10">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm border border-indigo-500/20">
                      CSV
                    </div>
                    <div>
                      <div className="text-lg font-black text-white tracking-tight">Upload</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Excel, CSV, or PDF artifacts</div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="relative">
                      <input 
                        ref={fileRef} 
                        type="file" 
                        accept=".xlsx,.csv,.pdf" 
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" 
                      />
                      <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/10 bg-white/5 p-6 transition-all group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10">
                        <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-400">Choose file or drag here</span>
                        <span className="mt-1 text-[9px] font-medium text-slate-500">Limited to 100 rows</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-[2.5rem] border-2 border-white/5 bg-[#1a1a1f] p-8 transition-all hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm border border-emerald-500/20">
                      G
                    </div>
                    <div>
                      <div className="text-lg font-black text-white tracking-tight">Cloud Documents</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Google Sheets & Docs Sync</div>
                    </div>
                  </div>
                  <div className="mt-6 space-y-4">
                    <input
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-[#131316] px-5 py-4 text-xs font-bold text-white placeholder-slate-500 ring-emerald-500/20 transition-all focus:border-emerald-500 focus:outline-none focus:ring-4"
                      placeholder="Sheet or Doc URL..."
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${googleConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-slate-600"}`} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {googleConnected ? "Connected" : "No Auth"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {!googleConnected ? (
                          <button
                            type="button"
                            onClick={() => connectGoogle().catch((e) => setErr(e instanceof Error ? e.message : "Connect failed"))}
                            className="rounded-xl bg-white/10 border border-white/5 px-3 py-2 text-[10px] font-black text-white hover:bg-emerald-600 hover:border-emerald-500 transition-all active:scale-95"
                          >
                            Connect
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => disconnectGoogle().catch((e) => setErr(e instanceof Error ? e.message : "Disconnect failed"))}
                            className="rounded-xl border border-white/10 bg-transparent px-3 py-2 text-[10px] font-black text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-all active:scale-95"
                          >
                            Reset API
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-t border-white/10 pt-10">
                <div className="max-w-md">
                  {successMsg ? <div className="text-emerald-400 font-bold text-sm bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">{successMsg}</div> : null}
                  {err ? <div className="text-rose-400 font-bold text-sm bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl">{err}</div> : null}
                  {!err && !successMsg && !canRunJobs ? (
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                      ⚙️ Check System Integrity before proceeding
                    </span>
                  ) : (
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Execution engine ready for request</div>
                  )}
                </div>
                
                <button
                  onClick={createJob}
                  className="group relative flex items-center gap-4 rounded-[2rem] bg-indigo-600 px-10 py-5 text-sm font-black text-white shadow-2xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden"
                  disabled={busy || !canRunJobs}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative">{busy ? "ENGINE RUNNING..." : "GENERATE & DEPLOY"}</span>
                  {!busy && <span className="relative text-xl group-hover:translate-x-1 transition-transform">→</span>}
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#131316] p-8 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all hover:border-white/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
                <div>
                  <div className="text-xl font-black text-white italic">Project Activity</div>
                  <div className="text-sm font-medium text-slate-400 mt-1">Real-time status of your generated deployments.</div>
                </div>
                {activeJob && (
                  <div className="flex flex-wrap gap-3">
                    <Pill label="Status" value={activeJob.status} />
                    <Pill
                      label="Network"
                      value={progress ? `${progress.deployed}/${progress.total} Cloudflare Nodes` : "-"}
                    />
                  </div>
                )}
              </div>

              {!activeJob ? (
                <div className="mt-12 text-center py-20 bg-white/5 rounded-3xl border-2 border-dashed border-white/10">
                  <div className="text-white font-bold text-lg">Select a project to view deep insights</div>
                  <p className="text-slate-400 text-sm mt-2">URLs and deployment logs will appear here.</p>
                </div>
              ) : (
                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {activeSites.map((s) => (
                    <div key={s.id} className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#1a1a1f] p-6 shadow-2xl transition-all hover:shadow-indigo-500/10 hover:-translate-y-1 hover:border-indigo-500/30">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Row {s.row_index}</div>
                          <div className="text-lg font-black text-white line-clamp-1">{s.title}</div>
                        </div>
                        <div className={`h-2 w-2 rounded-full mt-2 ${s.status === "failed" ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} title={s.status} />
                      </div>
                      
                      <div className="mt-6 flex flex-col gap-3">
                        {s.url ? (
                          <div className="flex items-center gap-2">
                            <a 
                              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-black transition-all hover:bg-slate-200 active:scale-95" 
                              href={s.url} 
                              target="_blank" 
                              rel="noreferrer"
                            >
                              Launch Site <span>↗</span>
                            </a>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(s.url || '').then(() => alert('URL Copied!'));
                              }}
                              className="aspect-square flex items-center justify-center rounded-xl border border-white/10 bg-[#131316] p-3 text-white transition-all hover:bg-white/10 active:scale-95"
                              title="Copy Link"
                            >
                              🔗
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-[11px] font-bold text-slate-400 border border-white/10">
                            <div className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" />
                            Awaiting Cloudflare Edge...
                          </div>
                        )}
                      </div>
                      {s.error && (
                        <div className="mt-4 rounded-xl bg-rose-500/10 p-4 text-[11px] font-bold text-rose-400 border border-rose-500/20 leading-relaxed">
                          {s.error}
                        </div>
                      )}
                    </div>
                  ))}
                  {activeSites.length === 0 && <div className="text-sm font-bold text-slate-400 italic">No sites generated for this project.</div>}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-[#131316] p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="text-xl font-black text-white italic">Projects</div>
                <button
                  onClick={() => refreshJobs().catch((e) => setErr(e.message))}
                  className="rounded-xl bg-indigo-500/20 px-4 py-2 text-xs font-black text-indigo-300 shadow-lg shadow-black/20 transition-all hover:bg-indigo-500/40 hover:text-white active:scale-95"
                >
                  Refresh
                </button>
              </div>
              <div className="mt-6 space-y-4">
                {jobs.length === 0 ? (
                  <div className="text-sm font-medium text-slate-500 py-10 text-center border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                    No active projects.
                  </div>
                ) : (
                  jobs.map((j) => (
                    <div key={j.id} className="group relative">
                      <button
                        onClick={() => setActiveJobId(j.id)}
                        className={
                          "w-full rounded-2xl border border-white/5 p-4 text-left transition-all duration-300 " +
                          (activeJobId === j.id 
                            ? "border-indigo-500/50 bg-indigo-500/10 shadow-inner" 
                            : "bg-[#1a1a1f] hover:border-white/20 hover:bg-[#202026]")
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className={`text-xs font-black uppercase tracking-widest ${activeJobId === j.id ? "text-indigo-400" : "text-slate-400"}`}>
                            {j.status}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400">
                            {new Date(j.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-sm font-bold text-white">
                            {j.deployed_sites} / {j.total_sites} Live
                          </div>
                          <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-500" 
                                 style={{ width: `${(j.deployed_sites / j.total_sites) * 100}%` }} />
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteJob(j.id).catch((err) => setErr(err.message));
                        }}
                        className="absolute -right-2 -top-2 flex h-8 w-8 scale-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 shadow-lg ring-1 ring-white/10 transition-transform group-hover:scale-100 hover:bg-rose-500 hover:text-white"
                        title="Delete History"
                      >
                        <span className="font-bold text-xs">✕</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="rounded-[2rem] bg-gradient-to-br from-indigo-600/20 to-indigo-900/40 border border-indigo-500/20 p-8 text-white shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500 rounded-full blur-[80px] opacity-20" />
              <div className="relative">
                <div className="text-lg font-black italic text-white">Pro Note</div>
                <p className="mt-3 text-sm font-medium text-indigo-100 leading-relaxed">
                  Connect your Google account to instantly deploy from private Sheets. Ideal for enterprise workflows.
                </p>
                <div className="mt-6 h-1 w-12 bg-indigo-500/50 rounded-full" />
              </div>
            </div>
          </div>
          </div>
        )}

        {activeTab === "deployments" && (
          <div className="mt-10 flex flex-col items-center justify-center py-32 bg-[#131316]/50 rounded-[2rem] border border-white/5 backdrop-blur-xl">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 mb-6 shadow-[0_0_40px_rgba(99,102,241,0.2)]">
              <span className="text-4xl">🚀</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-3">Deployments</h2>
            <p className="text-slate-400 font-medium max-w-sm text-center leading-relaxed">
              Global edge deployments history will appear here. Coming soon in Enterprise v2.1.
            </p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="mt-10 flex flex-col items-center justify-center py-32 bg-[#131316]/50 rounded-[2rem] border border-white/5 backdrop-blur-xl">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 mb-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
              <span className="text-4xl">⚙️</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-3">Workspace Settings</h2>
            <p className="text-slate-400 font-medium max-w-sm text-center leading-relaxed">
              Configure your enterprise APIs, integrations, and access tokens here. Coming soon in Enterprise v2.1.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 999, padding: "6px 10px", background: "#fff" }}>
      <span style={{ color: "#6b7280", fontSize: 12, marginRight: 6 }}>{label}:</span>
      <span style={{ fontWeight: 650 }}>{value}</span>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[11px] backdrop-blur-sm">
      <span className="font-black uppercase tracking-wider text-slate-500 mr-2">{label}</span> 
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

function SetupCard({ config, webSupabaseReady }: { config: ConfigStatus | null; webSupabaseReady: boolean }) {
  const badge = (variant: "ok" | "warn" | "info", text: string) => {
    const cls =
      variant === "ok"
        ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20"
        : variant === "warn"
          ? "bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20"
          : "bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20";
    return <span className={`rounded-xl px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${cls}`}>{text}</span>;
  };

  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
        <div className="text-sm font-black italic text-slate-800">System Integrity</div>
        <div className="text-[10px] font-bold text-slate-500">Auto-validating configurations...</div>
      </div>
      {!config ? (
        <div className="mt-2 text-sm text-slate-600 font-bold animate-pulse">Checking configuration...</div>
      ) : (
        <div>
          <div className="flex flex-col gap-3">
            <CheckItem 
              label="Supabase User Authentication" 
              sub="Handles login and secure data access"
              status={webSupabaseReady ? "ok" : "warn"} 
            />
            <CheckItem 
              label="Backend API Connection" 
              sub="Manages site generation logic"
              status={config.supabase.status === "ok" ? "ok" : "warn"} 
              detail={config.supabase.status !== "ok" ? config.supabase.missingKeys.join(", ") : null}
            />
            <CheckItem 
              label="Cloudflare Infrastructure" 
              sub="Global edge network deployments"
              status={config.cloudflare.status === "ok" ? "ok" : "warn"} 
              detail={config.cloudflare.status !== "ok" ? config.cloudflare.missingKeys.join(", ") : null}
            />
            <CheckItem 
              label="Database Optimization" 
              sub="Site schemas and indexing"
              status={config.tablesStatus === "ok" ? "ok" : "info"} 
              detail={config.tablesStatus !== "ok" ? config.tablesError : null}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
              <ShortCheck label="Custom Domains" status={config.customDomains.status === "ok" ? "ok" : "info"} />
              <ShortCheck label="Google Sheets API" status={config.googleSheets?.status === "ok" ? "ok" : "info"} />
              <ShortCheck label="OAuth Integration" status={config.googleOAuth?.status === "ok" ? "ok" : "info"} />
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {config.googleOAuth?.redirectUrl && (
              <div className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 p-8 shadow-xl shadow-indigo-100/40 backdrop-blur-2xl transition-all hover:shadow-2xl hover:shadow-indigo-200/50">
                <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-indigo-400/10 blur-[60px] pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-blue-400/10 blur-[60px] pointer-events-none" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between border-b border-indigo-100/50 pb-5 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 shadow-inner">
                        <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
                      </div>
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-900">Developer Console Config</div>
                    </div>
                  </div>
                  
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 transition-all hover:shadow-md hover:ring-indigo-300">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Redirect URI</div>
                        <button onClick={() => { navigator.clipboard.writeText(config.googleOAuth?.redirectUrl || ''); alert('Copied Redirect URL'); }} className="flex h-6 items-center justify-center rounded-lg bg-slate-50 px-3 text-[9px] font-black text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 active:scale-95">COPY</button>
                      </div>
                      <div className="truncate font-mono text-xs font-semibold text-slate-700">
                        {config.googleOAuth.redirectUrl}
                      </div>
                    </div>

                    {config.googleOAuth?.clientId && (
                      <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 transition-all hover:shadow-md hover:ring-emerald-300">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">OAuth Client ID</div>
                          <button onClick={() => { navigator.clipboard.writeText(config.googleOAuth?.clientId || ''); alert('Copied Client ID'); }} className="flex h-6 items-center justify-center rounded-lg bg-slate-50 px-3 text-[9px] font-black text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600 active:scale-95">COPY</button>
                        </div>
                        <div className="truncate font-mono text-xs font-semibold text-slate-700">
                          {config.googleOAuth.clientId}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-8 shadow-2xl transition-all hover:shadow-indigo-900/30">
              <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-indigo-500/20 blur-[80px] pointer-events-none" />
              <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none" />
              
              <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                      <div className={`h-2.5 w-2.5 rounded-full ${config.googleOAuthTokensTable?.status === "ok" ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" : "bg-amber-400 animate-pulse"}`} />
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-white">Database Sync Manager</div>
                  </div>
                  <p className="mt-4 max-w-sm text-[12px] font-medium leading-relaxed text-slate-400">
                    Advanced persistence mechanism for resolving state synchronization across multiple globally distributed edge nodes.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {config.supabase?.project?.ref && (
                    <a
                      className="group flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-[11px] font-black uppercase tracking-wider text-white ring-1 ring-white/20 transition-all hover:bg-white hover:text-slate-900 active:scale-95 shadow-xl"
                      href={`https://supabase.com/dashboard/project/${config.supabase.project.ref}/sql`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>SQL Console</span>
                      <strong className="opacity-60 transition-transform group-hover:translate-x-1 group-hover:opacity-100">→</strong>
                    </a>
                  )}
                  <button
                    className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-[11px] font-black uppercase tracking-wider text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-400 active:scale-95"
                    onClick={() => {
                      const sql = `-- Advanced persistent table schema\ncreate table if not exists public.google_oauth_tokens (...);`; 
                      navigator.clipboard.writeText(sql).then(() => alert("SQL command copied."));
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" /></svg>
                    Copy Engine SQL
                  </button>
                </div>
              </div>
            </div>

            {config.nextSteps?.length ? (
              <div className="group relative overflow-hidden rounded-[2rem] bg-indigo-600 p-8 text-white shadow-2xl shadow-indigo-100">
                <div className="absolute top-0 right-0 -tr-1/4 h-32 w-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
                <div className="relative">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200 mb-6">Expert Implementation Roadmap</div>
                  <div className="grid gap-4">
                    {config.nextSteps.map((s, i) => (
                      <div key={i} className="flex gap-4 items-start p-4 rounded-3xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-400/20 text-[10px] font-black text-indigo-100">{i + 1}</div>
                        <div className="text-xs font-bold leading-normal text-indigo-50">{s}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckItem({ label, sub, status, detail }: { label: string; sub: string; status: "ok" | "warn" | "info"; detail?: string | null }) {
  const isOk = status === "ok";
  const isWarn = status === "warn";

  return (
    <div className={`flex flex-col gap-2 rounded-2xl border p-4 transition-all duration-300 ${isOk ? "bg-white border-slate-100 shadow-sm" : "bg-white/50 border-amber-100"}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold transition-colors ${
            isOk ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" : isWarn ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
          }`}>
            {isOk ? "✓" : isWarn ? "!" : "?"}
          </div>
          <div>
            <div className="text-sm font-black text-slate-800 tracking-tight">{label}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sub}</div>
          </div>
        </div>
        <div className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${
          isOk ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : isWarn ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-slate-50 text-slate-500 border border-slate-200"
        }`}>
          {isOk ? "Verified" : isWarn ? "Failed" : "Optional"}
        </div>
      </div>
      {detail && (
        <div className="mt-2 rounded-lg bg-amber-50/50 p-2 text-[10px] font-bold text-amber-700 border border-amber-100/50 line-clamp-1">
          {detail}
        </div>
      )}
    </div>
  );
}

function ShortCheck({ label, status }: { label: string; status: "ok" | "warn" | "info" }) {
  const isOk = status === "ok";
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-[11px] font-black text-slate-600">{label}</div>
      <div className={`h-2 w-2 rounded-full ${isOk ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300"}`} title={status} />
    </div>
  );
}
