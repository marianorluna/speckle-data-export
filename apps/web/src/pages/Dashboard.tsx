import { useAuth } from "../hooks/useAuth";

export function DashboardPage() {
  const { user, logout, isLoadingUser } = useAuth();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLoadingUser
              ? "Cargando usuario…"
              : user
                ? `Sesión: ${user.email}`
                : "Sesión activa"}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
