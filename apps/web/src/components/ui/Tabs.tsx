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
  /**
   * Keep visited panels mounted (hidden when inactive) so heavy children
   * (e.g. Speckle viewer) are not reloaded on every tab switch.
   */
  keepMounted?: boolean;
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
  keepMounted = true,
}: TabsProps) {
  const baseId = useId();
  const initial =
    tabs.find((tab) => tab.id === defaultTabId)?.id ?? tabs[0]?.id ?? "";
  const [activeId, setActiveId] = useState(initial);
  const [visitedIds, setVisitedIds] = useState(() => new Set<string>([initial]));
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  if (!active) {
    return null;
  }

  const selectTab = (id: string) => {
    setActiveId(id);
    setVisitedIds((prev) => {
      if (prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

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
    selectTab(next.id);
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
              onClick={() => selectTab(tab.id)}
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

      {keepMounted
        ? tabs.map((tab) => {
            if (!visitedIds.has(tab.id)) {
              return null;
            }
            const selected = tab.id === active.id;
            return (
              <div
                key={tab.id}
                id={`${baseId}-panel-${tab.id}`}
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-${tab.id}`}
                hidden={!selected}
                className={
                  selected
                    ? `flex min-h-0 flex-1 flex-col ${panelClassName}`.trim()
                    : "hidden"
                }
              >
                {tab.panel}
              </div>
            );
          })
        : (
            <div
              id={`${baseId}-panel-${active.id}`}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${active.id}`}
              className={`min-h-0 flex-1 ${panelClassName}`.trim()}
            >
              {active.panel}
            </div>
          )}
    </div>
  );
}
