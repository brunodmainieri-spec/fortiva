import type { AppData } from "./domain";
import {
  dayMacros,
  goalAt,
  periodStats,
  shiftDate,
  today,
  volume,
  weightDisplay,
  weightUnit,
} from "./domain";
import { energyStats } from "./energy-domain";

export type AssistantTopic =
  | "summary"
  | "calories"
  | "macros"
  | "energy"
  | "basal"
  | "anomaly"
  | "weight"
  | "training"
  | "coverage";
export type AssistantSelection = {
  topic: AssistantTopic;
  dates: string[];
  exerciseId?: string;
};
export type AssistantAction = { label: string; to: string };
export const TOPIC_LABELS: Record<AssistantTopic, string> = {
  summary: "Resumo do período",
  calories: "Calorias e metas",
  macros: "Macronutrientes",
  energy: "Saldo energético",
  basal: "Metabolismo basal",
  anomaly: "Valores discrepantes",
  weight: "Peso e estimativas",
  training: "Evolução de cargas",
  coverage: "Qualidade dos registros",
};
export const QUESTIONS: Record<AssistantTopic, string> = {
  summary: "Como foi este período?",
  calories: "Por que fiquei acima ou abaixo da meta?",
  macros: "Como estão meus macronutrientes?",
  energy: "Por que o saldo difere das calorias abaixo da meta?",
  basal: "Como o basal entra nesta comparação?",
  anomaly: "Existe algum gasto fora do padrão?",
  weight: "Por que peso e equivalente teórico são diferentes?",
  training: "Como mudou minha carga e minhas repetições?",
  coverage: "Quais dias ficaram fora da comparação?",
};
const energyPath = (date: string) =>
  `/evolucao?tab=energy&period=day&date=${date}#registros-energia`;
// Explicit projection: no email, photographs, food descriptions or authentication data.
// The existing domain functions remain the authoritative source of arithmetic.
export function buildAssistantFacts(
  data: AppData,
  selection: AssistantSelection,
  currentDate = today(),
) {
  const dates = [...new Set(selection.dates)]
    .filter(
      (d) =>
        /^\d{4}-\d{2}-\d{2}$/.test(d) &&
        shiftDate(d, 0) === d &&
        d <= currentDate,
    )
    .sort()
    .slice(0, 31);
  const diet = periodStats(data, dates, currentDate);
  const energy = energyStats(data, dates, currentDate);
  const days = energy.rows.map((row) => ({
    date: row.date,
    recorded: row.consumed !== null,
    confirmed: row.foodConfirmed,
    closed: row.closed,
    macros: dayMacros(data, row.date),
    goal: goalAt(data, row.date),
    total: row.total,
    basal: row.basal,
    source: row.entry?.source ?? null,
    simulated: row.entry?.simulated ?? false,
  }));
  const completed = data.sessions
    .filter((s) => s.finishedAt && dates.includes(s.date))
    .sort((a, b) => (a.date + a.startedAt).localeCompare(b.date + b.startedAt));
  const exerciseId =
    selection.exerciseId ??
    completed
      .flatMap((s) => s.exercises)
      .find((e) => e.sets.some((v) => v.done))?.exerciseId;
  const exerciseSessions = completed.flatMap((s) => {
    const exercise = s.exercises.find((e) => e.exerciseId === exerciseId);
    const sets = exercise?.sets.filter((v) => v.done);
    return sets?.length
      ? [
          {
            date: s.date,
            id: s.id,
            name: exercise!.name,
            sets: sets.map((v) => ({
              weight: weightDisplay(v.weight, data.profile.units),
              reps: v.reps,
            })),
          },
        ]
      : [];
  });
  const measurements = data.measurements
    .filter((m) => dates.includes(m.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({
      date: m.date,
      weight: weightDisplay(m.weight, data.profile.units),
    }));
  return {
    dates,
    currentDate,
    days,
    diet,
    period:
      selection.dates.length === 1
        ? "day"
        : selection.dates.length <= 7
          ? "week"
          : "month",
    energy: {
      net: energy.net,
      deficit: energy.deficit,
      surplus: energy.surplus,
      comparableDays: energy.comparableDays,
      theoreticalWeight:
        energy.theoreticalKg === null
          ? null
          : weightDisplay(energy.theoreticalKg, data.profile.units),
      basalComparedDays: energy.basalComparedDays,
      basalNet: energy.basalNet,
    },
    training: {
      count: completed.length,
      volume: weightDisplay(
        completed.reduce((n, s) => n + volume(s), 0),
        data.profile.units,
      ),
      exerciseSessions,
    },
    measurements,
    unit: weightUnit(data.profile),
    sources: days
      .filter((d) => d.recorded || d.total !== null || d.basal !== null)
      .map((d) => ({
        label: `Registros de ${d.date}`,
        to:
          d.total !== null || d.basal !== null
            ? energyPath(d.date)
            : `/?date=${d.date}`,
      })),
  };
}
export type AssistantFacts = ReturnType<typeof buildAssistantFacts>;
export type AssistantAnswer = {
  topic: AssistantTopic | "unsupported";
  title: string;
  paragraphs: string[];
  evidence: string[];
  actions: AssistantAction[];
  suggestions: AssistantTopic[];
  simulated: boolean;
};
export type AssistantRequest = {
  question: string;
  selection: AssistantSelection;
  facts: AssistantFacts;
  previousTopic?: AssistantTopic;
  history?: { question: string; answer: string }[];
};
export interface ConversationService {
  readonly mode: "mock" | "remote";
  reply(
    request: AssistantRequest,
    signal: AbortSignal,
  ): Promise<AssistantAnswer>;
}
export { energyPath };
