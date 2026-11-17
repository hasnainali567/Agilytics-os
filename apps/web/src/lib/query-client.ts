import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1";
