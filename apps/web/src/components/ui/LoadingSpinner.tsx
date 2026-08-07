type LoadingSpinnerProps = {
  label?: string;
};

export function LoadingSpinner({ label = "Cargando…" }: LoadingSpinnerProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
        aria-hidden
      />
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}
