import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Bot, Minus } from "lucide-react";

import { ChatPanel } from "./ChatPanel";

type ChatFloatingWidgetProps = {
  /** Highlight elements in the dashboard (viewer + table) from chat results. */
  onSelectElements?: (elementIds: string[]) => void;
};

/** Bottom-right corner of the widget in viewport coordinates. */
type Anchor = { x: number; y: number };

const STORAGE_KEY = "bim-chat-fab-anchor";
const DRAG_THRESHOLD_PX = 6;
const FAB_SIZE_PX = 56;
const EDGE_MARGIN_PX = 16;
/** Approximate panel size for clamp when open (matches Tailwind min/max). */
const PANEL_WIDTH_PX = 384;
const PANEL_HEIGHT_PX = 448;

type DragSession = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

function defaultAnchor(): Anchor {
  return {
    x: window.innerWidth - EDGE_MARGIN_PX,
    y: window.innerHeight - EDGE_MARGIN_PX,
  };
}

function loadAnchor(): Anchor | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("x" in parsed) ||
      !("y" in parsed) ||
      typeof (parsed as Anchor).x !== "number" ||
      typeof (parsed as Anchor).y !== "number" ||
      !Number.isFinite((parsed as Anchor).x) ||
      !Number.isFinite((parsed as Anchor).y)
    ) {
      return null;
    }
    return { x: (parsed as Anchor).x, y: (parsed as Anchor).y };
  } catch {
    return null;
  }
}

function saveAnchor(anchor: Anchor): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(anchor));
  } catch {
    // Quota / private mode — ignore.
  }
}

function clampAnchor(anchor: Anchor, open: boolean): Anchor {
  const width = open ? Math.min(PANEL_WIDTH_PX, window.innerWidth - 2 * EDGE_MARGIN_PX) : FAB_SIZE_PX;
  const height = open
    ? Math.min(PANEL_HEIGHT_PX, window.innerHeight * 0.7)
    : FAB_SIZE_PX;
  const minX = EDGE_MARGIN_PX + width;
  const minY = EDGE_MARGIN_PX + height;
  const maxX = window.innerWidth - EDGE_MARGIN_PX;
  const maxY = window.innerHeight - EDGE_MARGIN_PX;
  return {
    x: Math.min(Math.max(anchor.x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(anchor.y, minY), Math.max(minY, maxY)),
  };
}

/**
 * Draggable FAB + floating chat panel; minimize keeps history mounted.
 * Anchor is the bottom-right corner; position persists in localStorage.
 */
export function ChatFloatingWidget({
  onSelectElements,
}: ChatFloatingWidgetProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor>(() => {
    if (typeof window === "undefined") {
      return { x: EDGE_MARGIN_PX + FAB_SIZE_PX, y: EDGE_MARGIN_PX + FAB_SIZE_PX };
    }
    return clampAnchor(loadAnchor() ?? defaultAnchor(), false);
  });
  const dragRef = useRef<DragSession | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const onResize = () => {
      setAnchor((prev) => clampAnchor(prev, open));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  useEffect(() => {
    setAnchor((prev) => clampAnchor(prev, open));
  }, [open]);

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: anchor.x,
      originY: anchor.y,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const dx = event.clientX - session.startClientX;
    const dy = event.clientY - session.startClientY;
    if (!session.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    session.moved = true;
    suppressClickRef.current = true;
    setAnchor(clampAnchor({ x: session.originX + dx, y: session.originY + dy }, open));
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (session.moved) {
      setAnchor((prev) => {
        const next = clampAnchor(prev, open);
        saveAnchor(next);
        return next;
      });
    }
    dragRef.current = null;
  };

  const onFabClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen(true);
  };

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: anchor.x,
        top: anchor.y,
        transform: "translate(-100%, -100%)",
      }}
    >
      {/* Keep ChatPanel mounted when minimized so conversation history persists. */}
      <div
        className={`pointer-events-auto flex h-[min(28rem,70dvh)] w-[min(22rem,calc(100vw-2rem))] flex-col sm:w-96 ${
          open ? "" : "hidden"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div
            className="flex shrink-0 cursor-grab touch-none items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 active:cursor-grabbing"
            onPointerDown={beginDrag}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">IA Chat</p>
              <p className="truncate text-xs text-gray-500">Consultas NL del modelo</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              onPointerDown={(event) => event.stopPropagation()}
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
          onClick={onFabClick}
          onPointerDown={beginDrag}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="pointer-events-auto flex h-14 w-14 cursor-grab touch-none items-center justify-center rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 active:cursor-grabbing"
          aria-label="Abrir chat IA"
        >
          <Bot className="h-6 w-6" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
