export type TrainingInput = {
  age: number;
  goal: "cutting" | "maintenance" | "bulking";
  experience: "beginner" | "intermediate" | "advanced";
  months: number;
  frequency: number;
  minutes: number;
};
export type TrainingProposal = {
  name: string;
  description: string;
  days: {
    name: string;
    exercises: { name: string; sets: number; reps: number; rest: number }[];
  }[];
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Dados de treino inválidos.");
  return value as Record<string, unknown>;
}
function integer(
  value: unknown,
  min: number,
  max: number,
  message: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error(message);
  return value;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("O plano retornou texto inválido. Tente novamente.");
  return value.trim();
}
export function trainingInput(value: unknown): TrainingInput {
  const p = object(value);
  if (
    !["cutting", "maintenance", "bulking"].includes(String(p.goal)) ||
    !["beginner", "intermediate", "advanced"].includes(String(p.experience))
  )
    throw new Error("Confira o objetivo e a experiência.");
  return {
    age: integer(
      p.age,
      18,
      120,
      "Informe uma idade entre 18 e 120 anos para gerar a proposta.",
    ),
    goal: p.goal as TrainingInput["goal"],
    experience: p.experience as TrainingInput["experience"],
    months: integer(p.months, 0, 1000, "Confira o tempo de prática em meses."),
    frequency: integer(p.frequency, 1, 7, "Escolha de 1 a 7 dias por semana."),
    minutes: integer(
      p.minutes,
      15,
      180,
      "Escolha de 15 a 180 minutos por treino.",
    ),
  };
}
export const setLimit = (p: TrainingInput) =>
  p.experience === "beginner" || p.months < 3 || p.age >= 60 ? 3 : 5;
export function trainingSchema(p: TrainingInput) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["name", "description", "days"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 80 },
      description: { type: "string", minLength: 1, maxLength: 1200 },
      days: {
        type: "array",
        minItems: p.frequency,
        maxItems: p.frequency,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "exercises"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            exercises: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "sets", "reps", "rest"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 120 },
                  sets: { type: "integer", minimum: 1, maximum: setLimit(p) },
                  reps: { type: "integer", minimum: 6, maximum: 20 },
                  rest: { type: "integer", minimum: 30, maximum: 180 },
                },
              },
            },
          },
        },
      },
    },
  };
}
export function parseTrainingProposal(
  value: unknown,
  p: TrainingInput,
): TrainingProposal {
  const root = object(value);
  if (!Array.isArray(root.days) || root.days.length !== p.frequency)
    throw new Error(
      "A proposta não respeitou os dias disponíveis. Tente novamente.",
    );
  return {
    name: text(root.name, 80),
    description: text(root.description, 1200),
    days: root.days.map((raw) => {
      const day = object(raw);
      if (!Array.isArray(day.exercises) || !day.exercises.length)
        throw new Error(
          "A proposta retornou uma quantidade inválida de exercícios.",
        );
      const seen = new Set<string>();
      const exercises = day.exercises.map((rawExercise) => {
        const ex = object(rawExercise);
        const name = text(ex.name, 120);
        const id = name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("pt-BR")
          .replace(/\s+/g, " ");
        if (seen.has(id))
          throw new Error(
            "A proposta retornou exercícios repetidos. Tente novamente.",
          );
        seen.add(id);
        return {
          name,
          sets: integer(
            ex.sets,
            1,
            setLimit(p),
            "Quantidade de séries inválida.",
          ),
          reps: integer(ex.reps, 6, 20, "Quantidade de repetições inválida."),
          rest: integer(ex.rest, 30, 180, "Tempo de descanso inválido."),
        };
      });
      const estimatedSeconds =
        300 +
        exercises.reduce(
          (sum, e) => sum + e.sets * e.reps * 3 + (e.sets - 1) * e.rest + 60,
          0,
        );
      if (estimatedSeconds > p.minutes * 60)
        throw new Error(
          "A proposta excedeu o tempo disponível. Tente gerar novamente.",
        );
      return { name: text(day.name, 80), exercises };
    }),
  };
}
