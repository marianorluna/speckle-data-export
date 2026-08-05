import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { decodeJwt } from "jose";
import { useNavigate } from "react-router-dom";

import {
  ApiError,
  apiRequest,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "../lib/api";

export type AuthUser = {
  id: number;
  email: string;
  is_active: boolean;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
};

function isTokenUnexpired(token: string): boolean {
  try {
    const payload = decodeJwt(token);
    if (typeof payload.exp !== "number") {
      return false;
    }
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = getAccessToken();
  const isAuthenticated = Boolean(token && isTokenUnexpired(token));

  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<AuthUser>("/api/auth/me"),
    enabled: isAuthenticated,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const data = await apiRequest<TokenResponse>("/api/auth/token", {
        method: "POST",
        form: { username: email, password },
        skipAuth: true,
      });
      setAccessToken(data.access_token);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/dashboard", { replace: true });
    },
  });

  const logout = () => {
    clearAccessToken();
    queryClient.removeQueries({ queryKey: ["auth"] });
    navigate("/login", { replace: true });
  };

  return {
    login: (email: string, password: string) =>
      loginMutation.mutateAsync({ email, password }),
    logout,
    isAuthenticated,
    user: userQuery.data ?? null,
    isLoadingUser: userQuery.isLoading,
    loginError:
      loginMutation.error instanceof ApiError
        ? loginMutation.error.message
        : loginMutation.error
          ? "No se pudo iniciar sesión"
          : null,
    isLoggingIn: loginMutation.isPending,
  };
}
