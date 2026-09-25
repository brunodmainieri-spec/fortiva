import { describe, expect, it, vi } from "vitest";
import {
  createHandler,
  parseEstimate,
  validatePhoto,
} from "../supabase/functions/analyze-meal-photo/index";
const photo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/RkAAAAASUVORK5CYII=";
const estimate = {
  items: [
    {
      name: "Arroz cozido",
      portion: 100,
      unit: "g",
      calories: 130,
      protein: 2.7,
      carbs: 28,
      fat: 0.3,
    },
  ],
  note: "Porção estimada pela foto.",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function setup(overrides: Record<string, string> = {}) {
  const env = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "public-key",
    OPENAI_API_KEY: "server-secret",
    ...overrides,
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json({ id: "user-1" }))
    .mockResolvedValueOnce(json(true))
    .mockResolvedValueOnce(
      json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(estimate) }],
          },
        ],
      }),
    );
  return {
    fetcher,
    handler: createHandler({
      env: (key) => env[key as keyof typeof env],
      fetch: fetcher,
    }),
  };
}
const request = (body: unknown = { photo }, auth = "Bearer user-token") =>
  new Request("https://test/functions/v1/analyze-meal-photo", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
describe("meal photo edge function", () => {
  it("handles CORS without calling paid services", async () => {
    const { handler, fetcher } = setup();
    const r = await handler(new Request("https://test", { method: "OPTIONS" }));
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-headers")).toContain(
      "authorization",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires a verified logged-in user before any analysis", async () => {
    const { handler, fetcher } = setup();
    expect((await handler(request({ photo }, ""))).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    fetcher
      .mockReset()
      .mockResolvedValueOnce(json({ error: "invalid token" }, 401));
    expect((await handler(request())).status).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects remote URLs and mislabeled image data before quota or provider calls", async () => {
    expect(() => validatePhoto("https://internal-server/image")).toThrow();
    expect(() =>
      validatePhoto("data:image/jpeg;base64," + btoa("not an image payload")),
    ).toThrow();
    const { handler, fetcher } = setup();
    expect(
      (await handler(request({ photo: "https://example.com/photo" }))).status,
    ).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("accepts the secret name already configured in the project", async () => {
    const { handler, fetcher } = setup({
      OPENAI_API_KEY: "",
      OPEN_AI_API_KEY: "alias-test-key",
    });
    const result = await handler(request());
    expect(result.status).toBe(200);
    expect(fetcher.mock.calls[2][1]?.headers).toMatchObject({
      Authorization: "Bearer alias-test-key",
    });
  });
  it("does not consume quota when the key is missing", async () => {
    const { handler, fetcher } = setup({ OPENAI_API_KEY: "" });
    expect((await handler(request())).status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("enforces the database quota before a paid request", async () => {
    const { handler, fetcher } = setup();
    fetcher
      .mockReset()
      .mockResolvedValueOnce(json({ id: "user-1" }))
      .mockResolvedValueOnce(json(false));
    expect((await handler(request())).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("uses image input, strict JSON, no response storage, and returns no credentials", async () => {
    const { handler, fetcher } = setup();
    const result = await handler(request());
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toEqual(estimate);
    const [url, init] = fetcher.mock.calls[2];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(init!.body as string);
    expect(body.store).toBe(false);
    expect(body.text.format.strict).toBe(true);
    expect(body.input[0].content[1].image_url).toBe(photo);
    expect(body.input[0].content[1].detail).toBe("high");
    expect(body).not.toHaveProperty("user");
  });
  it("preserves an empty detection and rejects invalid nutritional values", () => {
    expect(
      parseEstimate({ items: [], note: "Não há alimentos visíveis." }).items,
    ).toEqual([]);
    expect(() =>
      parseEstimate({
        items: [{ ...estimate.items[0], portion: 0 }],
        note: "",
      }),
    ).toThrow();
    expect(() =>
      parseEstimate({
        items: [{ ...estimate.items[0], calories: -1 }],
        note: "",
      }),
    ).toThrow();
    expect(() =>
      parseEstimate({
        items: [{ ...estimate.items[0], protein: Infinity }],
        note: "",
      }),
    ).toThrow();
  });
  it("does not expose raw provider errors or save a meal on failure", async () => {
    const { handler, fetcher } = setup();
    fetcher
      .mockReset()
      .mockResolvedValueOnce(json({ id: "user-1" }))
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ error: "server-secret" }, 401));
    const result = await handler(request());
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain("server-secret");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("rejects incomplete model output", async () => {
    const { handler, fetcher } = setup();
    fetcher
      .mockReset()
      .mockResolvedValueOnce(json({ id: "user-1" }))
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ status: "incomplete", output: [] }));
    expect((await handler(request())).status).toBe(502);
  });
});
