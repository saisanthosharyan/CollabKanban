
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Kanban, LockKeyhole, Mail } from "lucide-react";
import { hasToken, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasToken()) {
      router.replace("/");
    }
  }, [router]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to sign in. Try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#635bff] text-white">
            <Kanban size={25} />
          </div>
          <span className="text-2xl font-bold tracking-tight text-[#171923]">
            CollabKanban
          </span>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Sign in to access your team workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <div className="flex items-center rounded-xl border border-gray-200 px-3 focus-within:border-[#635bff] focus-within:ring-2 focus-within:ring-[#635bff]/10">
                <Mail size={18} className="text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent px-3 py-3 text-sm text-gray-900 outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="flex items-center rounded-xl border border-gray-200 px-3 focus-within:border-[#635bff] focus-within:ring-2 focus-within:ring-[#635bff]/10">
                <LockKeyhole size={18} className="text-gray-400" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent px-3 py-3 text-sm text-gray-900 outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#635bff] py-3.5 text-sm font-semibold text-white transition hover:bg-[#5148e5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="mt-7 text-center text-xs text-gray-400">
            Secure multi-tenant team collaboration
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-gray-400">
          © 2026 CollabKanban. All rights reserved.
        </p>
      </div>
    </main>
  );
}
