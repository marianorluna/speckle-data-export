import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

const DEMO_EMAIL = "invitado@marianorluna.com";
const DEMO_PASSWORD = "abc123";

export function LoginPage() {
  const { login, isAuthenticated, isLoggingIn, loginError } = useAuth();
  const [email, setEmail] = useState("");
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

  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
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
          <p className="text-sm text-slate-500">
            Demo (invitado) o acceso admin
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="font-medium text-slate-700">Credenciales demo</p>
          <p className="mt-1 font-mono">
            {DEMO_EMAIL} / {DEMO_PASSWORD}
          </p>
          <button
            type="button"
            onClick={fillDemo}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Rellenar invitado
          </button>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            placeholder="tu@email.com"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500"
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
