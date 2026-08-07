import { AlertCircle } from "lucide-react";

type ErrorMessageProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center"
      role="alert"
    >
      <AlertCircle className="h-8 w-8 text-red-500" aria-hidden />
      <p className="text-sm text-red-700">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-800 hover:bg-red-50"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
