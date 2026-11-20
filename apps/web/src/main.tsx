import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { configureAuth } from "./lib/auth";
import { queryClient } from "./lib/query-client";
import { router } from "./router";

// Re-apply the saved rail theme (light/dark) before first paint so the
// shell never flashes the wrong backdrop. See index.css: dark is a
// backdrop-only theme by design.
try {
  if (localStorage.getItem("agilytics.theme") === "dark") {
    document.documentElement.dataset.theme = "dark";
  }
} catch {
  // localStorage unavailable — light theme is the default.
}

configureAuth();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
