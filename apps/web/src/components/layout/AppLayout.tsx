import { useEffect, useId, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

const MOBILE_NAV_MQ = "(max-width: 1023px)";

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { pathname } = useLocation();
  const mobileNavId = useId();

  // Close drawer on route change (e.g. future nav links).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Close drawer when resizing up to desktop.
  useEffect(() => {
    const media = window.matchMedia(MOBILE_NAV_MQ);
    const onChange = () => {
      if (!media.matches) {
        setMobileNavOpen(false);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  // Avoid background scroll while the drawer is open on small screens.
  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  const closeMobileNav = () => setMobileNavOpen(false);
  const toggleMobileNav = () => setMobileNavOpen((open) => !open);

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50">
      {/* Desktop: persistent sidebar */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile / tablet: overlay drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${
          mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!mobileNavOpen}
      >
        <button
          type="button"
          tabIndex={mobileNavOpen ? 0 : -1}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            mobileNavOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Cerrar menú"
          onClick={closeMobileNav}
        />
        <div
          className={`absolute inset-y-0 left-0 shadow-xl transition-transform duration-200 ease-out ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar
            id={mobileNavId}
            showCloseButton
            onClose={closeMobileNav}
            onNavigate={closeMobileNav}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          menuOpen={mobileNavOpen}
          onMenuToggle={toggleMobileNav}
          menuControlsId={mobileNavId}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
