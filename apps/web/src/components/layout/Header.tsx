import { LogOut, Menu, X } from "lucide-react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { APP_NAME } from "../../lib/constants";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/elements": "Elementos",
  "/chat": "IA Chat",
};

type HeaderProps = {
  menuOpen: boolean;
  onMenuToggle: () => void;
  menuControlsId: string;
};

export function Header({
  menuOpen,
  onMenuToggle,
  menuControlsId,
}: HeaderProps) {
  const { user, logout, isLoadingUser } = useAuth();
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? APP_NAME;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuToggle}
          className="inline-flex rounded-md p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
          aria-label={menuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          aria-expanded={menuOpen}
          aria-controls={menuControlsId}
        >
          {menuOpen ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </button>
        <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <span className="hidden max-w-[12rem] truncate text-sm text-gray-500 sm:inline md:max-w-xs">
          {isLoadingUser
            ? "Cargando…"
            : user
              ? user.email
              : "Sesión activa"}
        </span>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 hover:bg-gray-50 sm:px-3"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}
