import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4">
      <p className="text-6xl font-bold text-gray-300">404</p>
      <h1 className="text-xl font-semibold text-gray-900">Página no encontrada</h1>
      <p className="text-sm text-gray-500">
        La ruta solicitada no existe en el dashboard.
      </p>
      <Link
        to="/dashboard"
        className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Volver al dashboard
      </Link>
    </main>
  );
}
