import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import {
  failure,
  getCatalog,
  NoPublishedPicksError,
  rateLimit,
  requestFpl,
  UpstreamError,
} from "./server";
afterEach(() => vi.unstubAllGlobals());
describe("upstream reliability", () => {
  it("uses only the fixed FPL origin and applies timeout/cache options", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    await requestFpl("fixtures/");
    expect(fetcher).toHaveBeenCalledWith(
      "https://fantasy.premierleague.com/api/fixtures/",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        next: { revalidate: 300 },
      }),
    );
  });
  it("rejects upstream service errors and sanitizes the message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private internal error", { status: 503 }),
        ),
    );
    await expect(requestFpl("fixtures/")).rejects.toBeInstanceOf(UpstreamError);
    const r = failure(new Error("sensitive internals"));
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("sensitive");
  });
  it("rejects malformed successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ unexpected: true })),
    );
    await expect(getCatalog()).rejects.toThrow();
  });
  it("handles network timeouts without fabricated data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Timeout", "TimeoutError")),
    );
    await expect(getCatalog()).rejects.toThrow("Timeout");
  });
  it("distinguishes unavailable entries and unpublished picks", async () => {
    expect(failure(new UpstreamError(404)).status).toBe(404);
    expect(await failure(new NoPublishedPicksError()).json()).toMatchObject({
      error: expect.stringContaining("Gameweek deadline"),
    });
  });
  it("throttles repeated requests", () => {
    const r = new Request("https://example.com/api/catalog", {
      headers: { "x-forwarded-for": "test-ip" },
    });
    for (let i = 0; i < 40; i++) expect(rateLimit(r)).toBe(false);
    expect(rateLimit(r)).toBe(true);
  });
});
