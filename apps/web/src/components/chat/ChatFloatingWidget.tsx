import { useState } from "react";
import { Bot, Minus } from "lucide-react";

import { ChatPanel } from "./ChatPanel";

type ChatFloatingWidgetProps = {
  /** Highlight elements in the dashboard (viewer + table) from chat results. */
  onSelectElements?: (elementIds: string[]) => void;
};

/**
 * FAB bottom-right: opens a floating chat panel; minimize keeps history mounted.
 * Lives above all dashboard tabs so NL queries work from Resumen, Elementos or Visor.
 */
export function ChatFloatingWidget({
  onSelectElements,
}: ChatFloatingWidgetProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="pointer-events-none fixed z-50 bottom-4 right-4 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]"
    >
      {/* Keep ChatPanel mounted when minimized so conversation history persists. */}
      <div
        className={`pointer-events-auto flex h-[min(28rem,70dvh)] w-[min(22rem,calc(100vw-2rem))] flex-col sm:w-96 ${
          open ? "" : "hidden"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">IA Chat</p>
              <p className="truncate text-xs text-gray-500">Consultas NL del modelo</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Minimizar chat"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 [&_>div]:h-full [&_>div]:rounded-none [&_>div]:border-0 [&_>div]:shadow-none">
            <ChatPanel hideHeader onSelectElements={onSelectElements} />
          </div>
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          aria-label="Abrir chat IA"
        >
          <Bot className="h-6 w-6" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
