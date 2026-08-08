/** Chat / text-to-SQL API types and mutation hook. */

import { useMutation } from "@tanstack/react-query";

import { apiRequest } from "../lib/api";
import { API_ENDPOINTS } from "../lib/constants";

export type ChatResult = {
  type: "query" | "refused" | "blocked" | "error";
  question: string | null;
  answer: string;
  results: Record<string, unknown>[];
  total_results: number;
  element_ids: string[];
  sql: string | null;
  blocked_until: string | null;
  strikes: number | null;
};

type ChatResponse = {
  success: boolean;
  data: ChatResult;
};

export async function postChat(question: string): Promise<ChatResult> {
  const response = await apiRequest<ChatResponse>(API_ENDPOINTS.chat, {
    method: "POST",
    body: { question },
  });
  return response.data;
}

export function useChatMutation() {
  return useMutation({
    mutationFn: postChat,
  });
}
