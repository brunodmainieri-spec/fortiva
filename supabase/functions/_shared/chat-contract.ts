function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Dados da conversa inválidos.");
  return v as Record<string, unknown>;
}
function text(v: unknown, max: number) {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw Error("Texto da conversa inválido ou muito longo.");
  return v.trim();
}
function numeric(v: unknown) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e12)
    throw Error("Valor inválido nos registros.");
  return v;
}
function metrics(v: unknown, keys: string[]) {
  const o = object(v);
  return Object.fromEntries(keys.map((k) => [k, numeric(o[k])]));
}
function list(v: unknown, max: number) {
  if (!Array.isArray(v) || v.length > max)
    throw Error("Quantidade de registros inválida.");
  return v;
}
function date(v: unknown) {
  const s = text(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error("Data inválida.");
  return s;
}
const macros = ["calories", "protein", "carbs", "fat"];
// Explicit projection at BOTH boundaries: unknown keys, photos and identity are discarded.
export function chatInput(v: unknown) {
  const r = object(v),
    f = object(r.facts),
    d = object(f.diet),
    t = object(f.training);
  return {
    question: text(r.question, 600),
    history: list(r.history ?? [], 6).map((raw) => {
      const h = object(raw);
      return { question: text(h.question, 600), answer: text(h.answer, 6000) };
    }),
    facts: {
      dates: list(f.dates, 31).map(date),
      currentDate: date(f.currentDate),
      unit: f.unit === "lb" ? "lb" : "kg",
      diet: {
        ...metrics(d, [
          "recorded",
          "confirmed",
          "incomplete",
          "denominator",
          "adherence",
          "excessCalories",
          "belowCalories",
        ]),
        total: metrics(d.total, macros),
      },
      energy: metrics(f.energy, [
        "net",
        "deficit",
        "surplus",
        "comparableDays",
        "theoreticalWeight",
        "basalComparedDays",
        "basalNet",
      ]),
      training: {
        ...metrics(t, ["count", "volume"]),
        exerciseSessions: list(t.exerciseSessions ?? [], 60).map((raw) => {
          const e = object(raw);
          return {
            date: date(e.date),
            name: text(e.name, 120),
            sets: list(e.sets, 100).map((s) => metrics(s, ["weight", "reps"])),
          };
        }),
      },
      measurements: list(f.measurements, 100).map((raw) => {
        const m = object(raw);
        return { date: date(m.date), weight: numeric(m.weight) };
      }),
      days: list(f.days, 31).map((raw) => {
        const day = object(raw);
        return {
          date: date(day.date),
          recorded: day.recorded === true,
          confirmed: day.confirmed === true,
          closed: day.closed === true,
          macros: metrics(day.macros, macros),
          goal: day.goal ? metrics(day.goal, macros) : null,
          total: numeric(day.total),
          basal: numeric(day.basal),
          simulated: day.simulated === true,
        };
      }),
    },
  };
}
export const chatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["paragraphs"],
  properties: {
    paragraphs: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 1000 },
    },
  },
};
export function chatOutput(v: unknown) {
  const r = object(v);
  const paragraphs = list(r.paragraphs, 6).map((p) => text(p, 1000));
  if (!paragraphs.length)
    throw Error("A IA retornou uma resposta vazia. Tente novamente.");
  return { paragraphs };
}
