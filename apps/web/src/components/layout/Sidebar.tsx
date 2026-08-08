import { LayoutDashboard, LogOut, X } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { APP_NAME } from "../../lib/constants";

const linkBase =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors";
const linkIdle = "text-gray-300 hover:bg-gray-800 hover:text-white";
const linkActive = "bg-gray-800 text-white";

type SidebarProps = {
  /** Called when a nav link is activated (closes mobile drawer). */
  onNavigate?: () => void;
  /** Show close control (mobile drawer only). */
  showCloseButton?: boolean;
  onClose?: () => void;
  id?: string;
};

export function Sidebar({
  onNavigate,
  showCloseButton = false,
  onClose,
  id,
}: SidebarProps) {
  const { user, logout, isLoadingUser } = useAuth();
  const isGuest =
    user?.role === "guest" || user?.role === "guest_extended";

  return (
    <aside
      id={id}
      className="flex h-full w-60 shrink-0 flex-col bg-gray-900 text-white"
    >
      <div className="flex items-start justify-between gap-2 border-b border-gray-800 px-5 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Speckle BIM
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">
            {APP_NAME}
          </h1>
        </div>
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Principal">
        <NavLink
          to="/dashboard"
          onClick={onNavigate}
          className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkIdle}`
          }
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
          Dashboard
        </NavLink>
      </nav>

      <div className="mt-auto border-t border-gray-800 p-3">
        <div className="px-1">
          {isLoadingUser ? (
            <p className="text-xs text-gray-400">Cargando…</p>
          ) : (
            <>
              <p
                className="break-all text-xs leading-snug text-gray-300"
                title={user?.email}
              >
                {user?.email ?? "Sesión activa"}
              </p>
              {isGuest ? (
                <p className="mt-0.5 text-xs text-gray-500">Invitado</p>
              ) : null}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
