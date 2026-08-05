import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { login, isAuthenticated, isLoggingIn, loginError } = useAuth();
  const [email, setEmail] = useState("admin@bim.local");
  const [password, setPassword] = useState("");

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login(email, password);
    } catch {
      // error surfaced via loginError
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            BIM Dashboard
          </h1>
          <p className="text-sm text-slate-500">Inicia sesión como admin</p>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
          />
        </label>

        {loginError ? (
          <p className="text-sm text-red-600" role="alert">
            {loginError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoggingIn}
          className="w-full bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isLoggingIn ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
