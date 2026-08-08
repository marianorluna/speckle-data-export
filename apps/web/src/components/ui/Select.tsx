import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  "aria-label": string;
  className?: string;
  disabled?: boolean;
};

type MenuPlacement = {
  top: number;
  left: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
};

const VIEWPORT_GAP = 8;

function computePlacement(
  trigger: DOMRect,
  menuWidth: number,
  menuHeight: number,
): MenuPlacement {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxWidth = Math.max(0, viewportWidth - VIEWPORT_GAP * 2);
  const width = Math.min(Math.max(menuWidth, trigger.width), maxWidth);

  let left = trigger.left;
  if (left + width > viewportWidth - VIEWPORT_GAP) {
    left = trigger.right - width;
  }
  left = Math.max(VIEWPORT_GAP, Math.min(left, viewportWidth - VIEWPORT_GAP - width));

  const spaceBelow = viewportHeight - trigger.bottom - VIEWPORT_GAP;
  const spaceAbove = trigger.top - VIEWPORT_GAP;
  const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;
  const available = openUp ? spaceAbove : spaceBelow;
  // Cap at half the free space so long lists scroll instead of filling the viewport.
  const maxHeight = Math.max(120, available * 0.5);

  const top = openUp
    ? Math.max(VIEWPORT_GAP, trigger.top - Math.min(menuHeight, maxHeight) - 4)
    : trigger.bottom + 4;

  return {
    top,
    left,
    minWidth: trigger.width,
    maxWidth,
    maxHeight,
  };
}

/**
 * Accessible listbox select with portal + viewport collision detection.
 * Escapes parent `overflow: hidden` and flips/shifts to stay on screen.
 */
export function Select({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  className = "",
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? options[0]?.label ?? "";

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }

    const updatePlacement = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger) {
        return;
      }
      const triggerRect = trigger.getBoundingClientRect();
      setPlacement(
        computePlacement(
          triggerRect,
          menu?.scrollWidth ?? triggerRect.width,
          menu?.scrollHeight ?? 200,
        ),
      );
    };

    updatePlacement();
    // Second pass once maxHeight/width constraints have been applied.
    const frame = window.requestAnimationFrame(updatePlacement);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, options]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menuStyle: CSSProperties = placement
    ? {
        top: placement.top,
        left: placement.left,
        minWidth: placement.minWidth,
        maxWidth: placement.maxWidth,
        maxHeight: placement.maxHeight,
        visibility: "visible",
      }
    : {
        top: 0,
        left: 0,
        visibility: "hidden",
      };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              style={menuStyle}
              className="fixed z-40 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={`${option.value}-${option.label}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`flex w-full items-center px-3 py-2 text-left text-gray-800 hover:bg-gray-50 ${
                      isSelected ? "bg-gray-100 font-medium" : ""
                    }`}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                  >
                    <span className="whitespace-nowrap">{option.label}</span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
