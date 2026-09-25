import { describe, expect, it } from "vitest";
import {
  blankData,
  food,
  periodDates,
  samplePlan,
  startSession,
} from "./domain";
import { buildAssistantFacts, QUESTIONS } from "./assistant-domain";
import type { AssistantTopic } from "./assistant-domain";
import { createMockConversationService, explain } from "./assistant-service";
function fixture() {
  const data = blankData("private@example.com", "Privado");
  data.goals = [
    {
      date: "2026-09-01",
      calories: 2000,
      protein: 100,
      carbs: 200,
      fat: 60,
      frequency: 3,
    },
    {
      date: "2026-09-21",
      calories: 1800,
      protein: 120,
      carbs: 180,
      fat: 60,
      frequency: 3,
    },
  ];
  data.meals = [
    "2026-09-18",
    "2026-09-19",
    "2026-09-20",
    "2026-09-21",
    "2026-09-22",
  ].map((date, i) => ({
    id: String(i),
    date,
    time: "12:00",
    type: "Almoço",
    items: [
      { ...food("PRIVATE FOOD", 2200, 130, 230, 50), photo: "PRIVATE PHOTO" },
    ],
  }));
  data.confirmedFoodDays = ["2026-09-18", "2026-09-21", "2026-09-22"];
  data.energy = data.meals.map((m, i) => ({
    id: String(i),
    date: m.date,
    totalCalories: i === 3 ? 5000 : 2400,
    activeCalories: 200,
    minutes: 30,
    source: "manual" as const,
    simulated: false,
    updatedAt: "",
  }));
  return data;
}
const selection = (topic: AssistantTopic) => ({
  topic,
  dates: periodDates("2026-09-22", "month"),
});
function request(topic: AssistantTopic, data = fixture()) {
  const s = selection(topic);
  return {
    question: QUESTIONS[topic],
    selection: s,
    facts: buildAssistantFacts(data, s, "2026-09-22"),
  };
}
describe("assistente contextual", () => {
  it("projeta somente dados necessários e não altera o perfil", () => {
    const data = fixture(),
      before = JSON.stringify(data);
    const r = request("summary", data);
    explain(r);
    expect(JSON.stringify(r.facts)).not.toMatch(
      /private@example|Privado|PRIVATE PHOTO|PRIVATE FOOD/,
    );
    expect(JSON.stringify(data)).toBe(before);
  });
  it("preserva metas históricas e exclui hoje e dias não confirmados do saldo", () => {
    const r = request("energy");
    expect(r.facts.energy.net).toBe(-3000);
    expect(r.facts.energy.comparableDays).toBe(2);
    expect(r.facts.diet.excessCalories).toBe(600);
    expect(r.facts.diet.denominator).toBe(2);
    expect(explain(r).paragraphs.join(" ")).toContain("-3.000 kcal");
  });
  it("retorna ausência de dados em vez de déficit zero inventado", () => {
    const data = blankData("a@b", "A");
    expect(request("weight", data).facts.energy.theoreticalWeight).toBeNull();
    expect(explain(request("calories", data)).paragraphs[0]).toContain(
      "Não há alimentação",
    );
    expect(explain(request("weight", data)).paragraphs[0]).toContain(
      "Sem dias comparáveis",
    );
  });
  it("basal não gera déficit total nem equivalente em peso", () => {
    const data = fixture();
    data.energy = [];
    data.basalHistory = [
      { date: "2026-09-01", calories: 1600, method: "manual" },
    ];
    const r = request("basal", data);
    expect(r.facts.energy.net).toBeNull();
    expect(r.facts.energy.basalNet).toBe(1200);
    expect(explain(r).paragraphs.join(" ")).toContain("apenas repouso");
  });
  it("expõe a base dos valores discrepantes e exige ao menos três comparadores", () => {
    const r = request("anomaly");
    const a = explain(r);
    expect(a.evidence.join(" ")).toContain(
      "2026-09-21: 5.000 kcal; média dos outros 3 dias: 2.400 kcal",
    );
    expect(a.actions[0].to).toContain("date=2026-09-21#registros-energia");
    r.facts.days = r.facts.days.slice(0, 2);
    expect(explain(r).paragraphs[0]).toContain("insuficiente");
  });
  it("respeita unidades, datas das pesagens e série sem carga externa", () => {
    const data = fixture();
    data.profile.units = "imperial";
    data.measurements = [
      { id: "a", date: "2026-09-18", weight: 80, waist: 0, arm: 0 },
      { id: "b", date: "2026-09-21", weight: 79, waist: 0, arm: 0 },
    ];
    const plan = samplePlan();
    const session = startSession(plan.days[0], plan.id, "2026-09-21");
    session.finishedAt = "2026-09-21T15:00:00Z";
    session.exercises[0].sets[0] = {
      id: "set",
      weight: 0,
      reps: 10,
      done: true,
    };
    data.sessions = [session];
    const r = request("weight", data);
    expect(r.facts.measurements[0].weight).toBeCloseTo(176.3698, 3);
    expect(explain(r).paragraphs.join(" ")).toContain(
      "2026-09-18 e 2026-09-21",
    );
    expect(explain(request("training", data)).evidence.join(" ")).toContain(
      "0 lb × 10",
    );
    expect(request("training", data).facts.training.volume).toBe(0);
  });
  it("perguntas não suportadas não disparam ações; continuação conserva assunto", () => {
    const r = request("energy");
    expect(explain({ ...r, question: "Qual remédio devo tomar?" }).topic).toBe(
      "unsupported",
    );
    expect(
      explain({ ...r, question: "Exclua meus registros" }).actions,
    ).toEqual([]);
    expect(
      explain({ ...r, question: "Explique melhor", previousTopic: "basal" })
        .topic,
    ).toBe("basal");
  });
  it("ignora datas inválidas/futuras e mantém mês parcial no link de peso", () => {
    const s = {
      topic: "weight" as const,
      dates: periodDates("2026-09-02", "month"),
    };
    const facts = buildAssistantFacts(fixture(), s, "2026-09-02");
    expect(facts.dates).toHaveLength(2);
    expect(
      explain({ selection: s, facts, question: QUESTIONS.weight }).actions[0]
        .to,
    ).toContain("period=month");
    expect(
      buildAssistantFacts(
        fixture(),
        { topic: "summary", dates: ["2026-02-30", "bad", "2026-09-23"] },
        "2026-09-22",
      ).dates,
    ).toEqual([]);
  });
  it("explica a diferença de hoje sem incluí-la nos somatórios finais", () => {
    const s = { topic: "calories" as const, dates: ["2026-09-22"] };
    const facts = buildAssistantFacts(fixture(), s, "2026-09-22");
    const answer = explain({
      question: QUESTIONS.calories,
      selection: s,
      facts,
    });
    expect(answer.paragraphs.join(" ")).toContain(
      "400 kcal acima da meta de 1.800 kcal",
    );
    expect(answer.paragraphs.join(" ")).toContain("comparação é parcial");
    expect(facts.diet.excessCalories).toBe(0);
  });
  it("cancelamento impede resposta tardia", async () => {
    const service = createMockConversationService(),
      abort = new AbortController();
    const result = service.reply(request("summary"), abort.signal);
    abort.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
});
