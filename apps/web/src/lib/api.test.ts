import { describe, expect, it } from "vitest";
import { apiUrl } from "./query-client";

describe("api client config", () => {
  it("points at a versioned API base URL", () => {
    expect(apiUrl).toMatch(/\/api\/v1$/);
  });
});
