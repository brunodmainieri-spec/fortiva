import { describe, expect, it, vi } from "vitest";
import { createHandler } from "../supabase/functions/generate-training-plan/index";
import {
  trainingInput,
  trainingSchema,
  parseTrainingProposal,
} from "../supabase/functions/_shared/training-contract";
const profile = {
  age: 30,
  goal: "maintenance",
  experience: "beginner",
  months: 2,
  frequency: 2,
  minutes: 40,
};
const proposal = {
  name: "Minha rotina",
  description: "Proposta para academia. Revise as cargas.",
  days: [
    {
      name: "Sessão A",
      exercises: [{ name: "Mesa flexora", sets: 2, reps: 12, rest: 60 }],
    },
    {
      name: "Sessão B",
      exercises: [
        {
          name: "Crucifixo inclinado com halteres",
          sets: 2,
          reps: 12,
          rest: 60,
        },
      ],
    },
  ],
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
function setup() {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json({ id: "verified-user" }))
    .mockResolvedValueOnce(json(true))
    .mockResolvedValueOnce(
      json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(proposal) }],
          },
        ],
      }),
    );
  const env: Record<string, string> = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "public",
    OPEN_AI_API_KEY: "existing-server-secret",
  };
  return {
    fetcher,
    handler: createHandler({ env: (name) => env[name], fetch: fetcher }),
  };
}
const request = (p: unknown = profile, token = "Bearer user-token") =>
  new Request("https://test/generate-training-plan", {
    method: "POST",
    headers: { Authorization: token },
    body: JSON.stringify({ profile: p }),
  });
describe("AI training contracts", () => {
  it("accepts more than four and eight exercises when they fit the available time", () => {
    const input = trainingInput({ ...profile, minutes: 60 });
    const value = {
      ...proposal,
      days: proposal.days.map((day) => ({
        ...day,
        exercises: Array.from({ length: 9 }, (_, i) => ({
          name: "Movimento " + i,
          sets: 2,
          reps: 12,
          rest: 60,
        })),
      })),
    };
    expect(parseTrainingProposal(value, input).days[0].exercises).toHaveLength(
      9,
    );
    expect(
      trainingSchema(input).properties.days.items.properties.exercises,
    ).not.toHaveProperty("maxItems");
    expect(() =>
      parseTrainingProposal(value, trainingInput({ ...profile, minutes: 15 })),
    ).toThrow();
  });
  it("accepts free exercise names without any app catalog", () => {
    const input = trainingInput(profile);
    expect(parseTrainingProposal(proposal, input)).toEqual(proposal);
    expect(
      trainingSchema(input).properties.days.items.properties.exercises.items
        .properties.name,
    ).not.toHaveProperty("enum");
  });
  it("projects only the required routine fields and validates age, frequency and duration", () => {
    expect(
      trainingInput({
        ...profile,
        email: "private",
        name: "private",
        weight: 90,
      }),
    ).toEqual(profile);
    for (const extra of [
      { age: 17 },
      { frequency: 0 },
      { frequency: 8 },
      { minutes: 14 },
      { months: -1 },
      { frequency: 2.5 },
    ])
      expect(() => trainingInput({ ...profile, ...extra })).toThrow();
  });
  it("rejects invalid output, excess volume, duplicate movements and wrong day counts", () => {
    const input = trainingInput(profile);
    expect(() =>
      parseTrainingProposal({ ...proposal, days: [] }, input),
    ).toThrow();
    const bad = structuredClone(proposal);
    bad.days[0].exercises[0].sets = 10;
    expect(() => parseTrainingProposal(bad, input)).toThrow();
    bad.days[0].exercises = [
      proposal.days[0].exercises[0],
      { ...proposal.days[0].exercises[0], name: " MESA FLEXORA " },
    ];
    expect(() => parseTrainingProposal(bad, input)).toThrow();
    bad.days[0].exercises = [
      { name: "Exercício escolhido pela IA", sets: 3, reps: 20, rest: 180 },
      { name: "Outro movimento", sets: 1, reps: 6, rest: 30 },
    ];
    expect(() =>
      parseTrainingProposal(bad, trainingInput({ ...profile, minutes: 15 })),
    ).toThrow();
  });
  it("discards model-supplied IDs, loads and activation flags", () => {
    const value = {
      ...proposal,
      active: true,
      days: proposal.days.map((day) => ({
        ...day,
        exercises: day.exercises.map((ex) => ({
          ...ex,
          weight: 999,
          exerciseId: "fake",
        })),
      })),
    };
    const parsed = parseTrainingProposal(value, trainingInput(profile));
    expect(parsed).not.toHaveProperty("active");
    expect(parsed.days[0].exercises[0]).not.toHaveProperty("weight");
  });
});
describe("AI training server", () => {
  it("blocks absent and invalid sessions before billing", async () => {
    const { handler, fetcher } = setup();
    expect((await handler(request(profile, ""))).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockReset().mockResolvedValueOnce(json({}, 401));
    expect((await handler(request())).status).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("validates the profile before reserving quota or invoking AI", async () => {
    const { handler, fetcher } = setup();
    expect((await handler(request({ ...profile, minutes: 0 }))).status).toBe(
      400,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("enforces the existing shared AI quota", async () => {
    const { handler, fetcher } = setup();
    fetcher
      .mockReset()
      .mockResolvedValueOnce(json({ id: "user" }))
      .mockResolvedValueOnce(json(false));
    expect((await handler(request())).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("uses the configured secret and sends routine only, with no catalog or stored response", async () => {
    const { handler, fetcher } = setup();
    const result = await handler(
      request({ ...profile, email: "private@example.com", name: "Private" }),
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(proposal);
    const [url, init] = fetcher.mock.calls[2];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer existing-server-secret",
    });
    const body = JSON.parse(init!.body as string);
    expect(body.store).toBe(false);
    expect(body.text.format.strict).toBe(true);
    const input = JSON.parse(body.input[0].content[0].text);
    expect(input.profile).toEqual(profile);
    expect(input).not.toHaveProperty("catalog");
    expect(JSON.stringify(body)).not.toContain("private@example.com");
    expect(fetcher.mock.calls).toHaveLength(3);
  });
  it("rejects invalid proposals without writing plans", async () => {
    const { handler, fetcher } = setup();
    fetcher
      .mockReset()
      .mockResolvedValueOnce(json({ id: "user" }))
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(
        json({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: '{"name":"bad","description":"bad","days":[]}',
                },
              ],
            },
          ],
        }),
      );
    expect((await handler(request())).status).toBe(502);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("does not leak provider errors or server secrets", async () => {
    const { handler, fetcher } = setup();
    fetcher
      .mockReset()
      .mockResolvedValueOnce(json({ id: "user" }))
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ error: "existing-server-secret" }, 401));
    const result = await handler(request());
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain("existing-server-secret");
  });
});
