import {
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type DashboardTab = {
  id: string;
  label: string;
  panel: ReactNode;
};

type TabsProps = {
  tabs: DashboardTab[];
  defaultTabId?: string;
  /** Extra classes on the root (e.g. flex-1 min-h-0). */
  className?: string;
  /** Classes for the active panel wrapper. */
  panelClassName?: string;
};

/**
 * Lightweight tab shell. Add future dashboard sections by appending to `tabs`
 * without changing existing panels.
 */
export function Tabs({
  tabs,
  defaultTabId,
  className = "",
  panelClassName = "",
}: TabsProps) {
  const baseId = useId();
  const initial =
    tabs.find((tab) => tab.id === defaultTabId)?.id ?? tabs[0]?.id ?? "";
  const [activeId, setActiveId] = useState(initial);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  if (!active) {
    return null;
  }

  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    if (!next) {
      return;
    }
    setActiveId(next.id);
    const nextButton = document.getElementById(`${baseId}-tab-${next.id}`);
    nextButton?.focus();
  };

  return (
    <div className={`flex min-h-0 flex-col ${className}`.trim()}>
      <div
        role="tablist"
        aria-label="Secciones del dashboard"
        className="flex shrink-0 gap-1 border-b border-gray-200"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                selected
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel-${active.id}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active.id}`}
        className={`min-h-0 flex-1 ${panelClassName}`.trim()}
      >
        {active.panel}
      </div>
    </div>
  );
}
