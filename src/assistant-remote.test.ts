import { describe, it, expect, vi } from "vitest";
import { blankData } from "./domain";
import { buildAssistantFacts } from "./assistant-domain";
import {
  chatInput,
  chatOutput,
} from "../supabase/functions/_shared/chat-contract";
import { createHandler } from "../supabase/functions/assistant-chat/index";
const requestData = () => ({
  question: "Como foi o período?",
  history: [],
  facts: buildAssistantFacts(
    blankData("private@email.com", "Privado"),
    { topic: "summary", dates: ["2026-09-23"] },
    "2026-09-23",
  ),
});
const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status });
const request = (body: unknown = requestData(), token = "Bearer user-token") =>
  new Request("https://test/assistant-chat", {
    method: "POST",
    headers: { Authorization: token },
    body: JSON.stringify(body),
  });
function setup(
  output: unknown = { paragraphs: ["Não há registros neste período."] },
) {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json({ id: "user" }))
    .mockResolvedValueOnce(json(true))
    .mockResolvedValueOnce(
      json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(output) }],
          },
        ],
      }),
    );
  const env: Record<string, string> = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "public",
    OPEN_AI_API_KEY: "secret",
  };
  return {
    fetcher,
    handler: createHandler({ env: (n) => env[n], fetch: fetcher }),
  };
}
describe("remote assistant", () => {
  it("projects private data out of context and preserves missing values", () => {
    const r = requestData();
    const v = chatInput({
      ...r,
      email: "private",
      facts: {
        ...r.facts,
        photo: "secret-photo",
        profile: { email: "private" },
      },
    });
    expect(JSON.stringify(v)).not.toMatch(/private|secret-photo|email/);
    expect(v.facts.energy.net).toBe(null);
    expect(v.facts.dates).toEqual(["2026-09-23"]);
  });
  it("bounds messages, history and provider output", () => {
    expect(() =>
      chatInput({ ...requestData(), question: "x".repeat(601) }),
    ).toThrow();
    expect(() =>
      chatInput({
        ...requestData(),
        history: Array(7).fill({ question: "q", answer: "a" }),
      }),
    ).toThrow();
    expect(() => chatOutput({ paragraphs: [] })).toThrow();
    expect(() => chatOutput({ paragraphs: ["x".repeat(1001)] })).toThrow();
    expect(
      chatOutput({ paragraphs: ["ok"], actions: [{ to: "https://evil" }] }),
    ).toEqual({ paragraphs: ["ok"] });
  });
  it("requires a verified session before invoking AI", async () => {
    const { handler, fetcher } = setup();
    expect((await handler(request({}, ""))).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockReset().mockResolvedValueOnce(json({}, 401));
    expect((await handler(request())).status).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid input before claiming quota", async () => {
    const { handler, fetcher } = setup();
    expect((await handler(request({ question: "" }))).status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses verified-user quota and avoids provider calls on exhaustion", async () => {
    const { handler, fetcher } = setup();
    fetcher
      .mockReset()
      .mockResolvedValueOnce(json({ id: "user" }))
      .mockResolvedValueOnce(json(false));
    expect((await handler(request())).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("passes bounded context and history with no storage or write tools", async () => {
    const { handler, fetcher } = setup();
    const r = {
      ...requestData(),
      history: [{ question: "Oi", answer: "Olá" }],
    };
    const response = await handler(request(r));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      paragraphs: ["Não há registros neste período."],
    });
    const body = JSON.parse(String(fetcher.mock.calls[2][1]?.body));
    expect(body.store).toBe(false);
    expect(body.tools).toBeUndefined();
    expect(JSON.parse(body.input[0].content[0].text).history).toEqual(
      r.history,
    );
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: "Bearer user-token",
    });
  });
  it("rejects malformed model output and hides provider errors", async () => {
    const bad = setup({ paragraphs: [] });
    expect((await bad.handler(request())).status).toBe(502);
    const { handler, fetcher } = setup();
    fetcher
      .mockReset()
      .mockResolvedValueOnce(json({ id: "user" }))
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ error: "secret-value" }, 500));
    const response = await handler(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret-value");
  });
});
