import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";

import { useChatMutation, type ChatResult } from "../../hooks/useChat";
import { ApiError } from "../../lib/api";

const SUGGESTED_QUESTIONS = [
  "Cuantos muros hay en total?",
  "Cual es el volumen total por categoria?",
  "Cuantos Structural Framing hay?",
  "Hay elementos sin nivel?",
  "Lista los floors del modelo",
] as const;

type Message = {
  role: "user" | "assistant";
  content: string;
  totalResults?: number;
  sql?: string | null;
  resultType?: ChatResult["type"];
  elementIds?: string[];
};

type ChatPanelProps = {
  /** Hide the built-in title block when wrapped by ChatFloatingWidget. */
  hideHeader?: boolean;
  /** Highlight matching BIM elements in the dashboard (DB element_id list). */
  onSelectElements?: (elementIds: string[]) => void;
};

function formatBlockedUntil(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type BlockReason = "abuse" | "quota" | null;

export function ChatPanel({
  hideHeader = false,
  onSelectElements,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<BlockReason>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mutation = useChatMutation();

  const isBlocked =
    blockedUntil !== null && new Date(blockedUntil).getTime() > Date.now();
  const blockedLabel = formatBlockedUntil(blockedUntil);
  const inputDisabled = mutation.isPending || isBlocked;

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, mutation.isPending]);

  useEffect(() => {
    if (!blockedUntil) {
      return;
    }
    const ms = new Date(blockedUntil).getTime() - Date.now();
    if (ms <= 0) {
      setBlockedUntil(null);
      setBlockReason(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setBlockedUntil(null);
      setBlockReason(null);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [blockedUntil]);

  const applyResult = (data: ChatResult) => {
    if (data.type === "blocked" && data.blocked_until) {
      setBlockedUntil(data.blocked_until);
      setBlockReason(data.strikes == null ? "quota" : "abuse");
    }
    const elementIds = data.element_ids ?? [];
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.answer,
        totalResults: data.total_results,
        sql: data.sql,
        resultType: data.type,
        elementIds: elementIds.length > 0 ? elementIds : undefined,
      },
    ]);
  };

  const sendQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || mutation.isPending || isBlocked) {
      return;
    }
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    mutation.mutate(trimmed, {
      onSuccess: applyResult,
      onError: (error) => {
        const detail =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Error desconocido";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: detail,
            resultType: "error",
          },
        ]);
      },
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendQuestion(input);
  };

  const bubbleClass = (resultType: ChatResult["type"] | undefined) => {
    if (resultType === "error" || resultType === "refused") {
      return "bg-amber-50 text-amber-950";
    }
    if (resultType === "blocked") {
      return "bg-red-50 text-red-900";
    }
    return "bg-gray-100 text-gray-900";
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {!hideHeader ? (
        <div className="shrink-0 border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Consultas NL</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Solo preguntas sobre el modelo ingerido (text-to-SQL).
          </p>
        </div>
      ) : null}

      {isBlocked ? (
        <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-800">
          {blockReason === "quota"
            ? `Has usado las preguntas de invitado de hoy${
                blockedLabel ? ` · disponible de nuevo a las ${blockedLabel}` : ""
              }.`
            : `Chat bloqueado${
                blockedLabel ? ` hasta las ${blockedLabel}` : ""
              } por consultas fuera de tema.`}
        </div>
      ) : null}

      {messages.length === 0 && !isBlocked ? (
        <div className="shrink-0 space-y-2 border-b border-gray-100 px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Sugerencias</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendQuestion(q)}
                disabled={inputDisabled}
                className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.map((msg, index) => (
          <div
            key={`${msg.role}-${index}`}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === "user"
                  ? "bg-gray-900 text-white"
                  : bubbleClass(msg.resultType)
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.totalResults !== undefined && msg.resultType === "query" ? (
                <p className="mt-1 text-xs opacity-70">
                  {msg.totalResults} resultado(s)
                </p>
              ) : null}
              {msg.sql ? (
                <pre className="mt-2 max-h-24 overflow-auto rounded bg-black/5 p-2 text-[10px] leading-snug opacity-80">
                  {msg.sql}
                </pre>
              ) : null}
              {msg.elementIds && msg.elementIds.length > 0 && onSelectElements ? (
                <button
                  type="button"
                  onClick={() => onSelectElements(msg.elementIds ?? [])}
                  className="mt-2 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
                >
                  Ver en visor ({msg.elementIds.length})
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {mutation.isPending ? (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
              Analizando…
            </div>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex shrink-0 gap-2 border-t border-gray-200 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isBlocked
              ? blockedLabel
                ? `Bloqueado hasta las ${blockedLabel}`
                : "Chat bloqueado"
              : "Pregunta algo sobre el modelo…"
          }
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 disabled:bg-gray-50 disabled:text-gray-500"
          disabled={inputDisabled}
          aria-label="Pregunta"
        />
        <button
          type="submit"
          disabled={inputDisabled || !input.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-3 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
