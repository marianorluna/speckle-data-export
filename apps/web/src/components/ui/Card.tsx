import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  value?: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function Card({
  title,
  value,
  subtitle,
  icon,
  children,
  className = "p-6",
}: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`.trim()}
    >
      {(title || icon || value !== undefined) && (
        <div
          className={`flex shrink-0 items-start justify-between gap-3 ${
            children ? "mb-3" : ""
          }`}
        >
          <div className="min-w-0">
            {title ? (
              <p className="text-sm font-medium text-gray-500">{title}</p>
            ) : null}
            {value !== undefined ? (
              <p className="mt-1 text-xl font-bold break-words text-gray-900 sm:text-2xl">
                {value}
              </p>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
            ) : null}
          </div>
          {icon ? <div className="shrink-0 text-gray-400">{icon}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}
