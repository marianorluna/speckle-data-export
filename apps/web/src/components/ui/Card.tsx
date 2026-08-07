import type { ReactNode } from "react";

type CardProps = {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
};

export function Card({ title, value, subtitle, icon }: CardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-xl font-bold break-words text-gray-900 sm:text-2xl">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
          ) : null}
        </div>
        {icon ? <div className="text-gray-400">{icon}</div> : null}
      </div>
    </div>
  );
}
