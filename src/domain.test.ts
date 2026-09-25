import { describe, expect, it } from "vitest";
import {
  blankData,
  calculateGoals,
  calorieBalance,
  createDemo,
  dayMacros,
  food,
  goalAt,
  initialProfile,
  lengthDisplay,
  lengthInternal,
  macroEnergy,
  periodDates,
  periodStats,
  samplePlan,
  scaleItem,
  shiftDate,
  startSession,
  sumMacros,
  volume,
  weightDisplay,
  weightInternal,
} from "./domain";

describe("metas nutricionais", () => {
  it("calcula Mifflin–St Jeor com coeficiente masculino e cutting", () => {
    const p = {
      ...initialProfile(),
      age: 30,
      weight: 80,
      height: 180,
      activity: 1.55,
    };
    const m = calculateGoals(p);
    expect(m.calories).toBe(Math.round(1780 * 1.55 * 0.9));
    expect(m.protein).toBe(128);
    expect(Math.abs(macroEnergy(m) - m.calories)).toBeLessThanOrEqual(7);
  });
  it("calcula manutenção com coeficiente feminino e bulking", () => {
    const p = {
      ...initialProfile(),
      coefficient: "female" as const,
      goal: "maintenance" as const,
      age: 30,
      weight: 60,
      height: 165,
      activity: 1.2,
    };
    expect(calculateGoals(p).calories).toBe(Math.round(1320.25 * 1.2));
    expect(calculateGoals({ ...p, goal: "bulking" }).calories).toBe(
      Math.round(1320.25 * 1.2 * 1.1),
    );
  });
  it("recusa cálculo automático para menores e opção manual", () => {
    expect(() => calculateGoals({ ...initialProfile(), age: 17 })).toThrow(
      "manuais",
    );
    expect(() =>
      calculateGoals({ ...initialProfile(), coefficient: "manual" }),
    ).toThrow("manuais");
    expect(() =>
      calculateGoals({ ...initialProfile(), weight: NaN }),
    ).toThrow();
  });
});
describe("refeições e indicadores", () => {
  it("soma itens e recalcula porção proporcionalmente sem mutar o original", () => {
    const item = food("Arroz", 120, 3, 25, 1, 100);
    const scaled = scaleItem(item, 150);
    expect(scaled.calories).toBe(180);
    expect(scaled.protein).toBe(4.5);
    expect(item.calories).toBe(120);
    expect(sumMacros([item, scaled]).carbs).toBe(62.5);
  });
  it("mantém a meta histórica válida por data, sem aplicar meta futura no passado", () => {
    const d = blankData("a@b.com", "A");
    d.goals = [
      {
        date: "2026-08-01",
        calories: 2000,
        protein: 100,
        carbs: 200,
        fat: 60,
        frequency: 3,
      },
      {
        date: "2026-09-10",
        calories: 1800,
        protein: 110,
        carbs: 190,
        fat: 55,
        frequency: 4,
      },
    ];
    expect(goalAt(d, "2026-07-31")).toBeNull();
    expect(goalAt(d, "2026-09-09")?.calories).toBe(2000);
    expect(goalAt(d, "2026-09-10")?.frequency).toBe(4);
  });
  it("exclui hoje, dias sem dados e metas ausentes do denominador de aderência", () => {
    const d = blankData("a@b.com", "A");
    d.goals = [
      {
        date: "2026-09-01",
        calories: 2000,
        protein: 100,
        carbs: 200,
        fat: 60,
        frequency: 3,
      },
    ];
    d.meals = [
      {
        id: "a",
        date: "2026-09-01",
        time: "12:00",
        type: "Almoço",
        items: [food("A", 2000, 100, 200, 60)],
      },
      {
        id: "b",
        date: "2026-09-02",
        time: "12:00",
        type: "Almoço",
        items: [food("B", 2500, 100, 200, 60)],
      },
      {
        id: "c",
        date: "2026-09-04",
        time: "12:00",
        type: "Almoço",
        items: [food("C", 300, 10, 20, 10)],
      },
    ];
    d.confirmedFoodDays = d.meals.map((m) => m.date);
    const stats = periodStats(
      d,
      ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"],
      "2026-09-04",
    );
    expect(stats.recorded).toBe(3);
    expect(stats.denominator).toBe(2);
    expect(stats.adherence).toBe(50);
    expect(stats.total.calories).toBe(4800);
    expect(periodStats(d, ["2026-09-03"], "2026-09-04").adherence).toBeNull();
  });
  it("recalcula o diário a partir dos itens atuais, incluindo exclusões", () => {
    const d = createDemo("2026-09-22");
    const before = dayMacros(d, "2026-09-22");
    const meal = d.meals.find((m) => m.date === "2026-09-22")!;
    const calories = meal.items[0].calories;
    meal.items.splice(0, 1);
    expect(dayMacros(d, "2026-09-22").calories).toBeCloseTo(
      before.calories - calories,
    );
  });
});
describe("datas locais", () => {
  it("usa segunda a domingo ao cruzar meses e anos", () => {
    expect(periodDates("2026-01-01", "week")).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ]);
    expect(periodDates("2026-09-27", "week")[0]).toBe("2026-09-21");
  });
  it("respeita calendário, anos bissextos e transição de dia", () => {
    expect(periodDates("2024-02-15", "month")).toHaveLength(29);
    expect(periodDates("2026-02-15", "month")).toHaveLength(28);
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });
});
describe("treinos, demonstração e unidades", () => {
  it("separa a prescrição das séries realizadas e conta apenas séries concluídas", () => {
    const p = samplePlan();
    const s = startSession(p.days[0], p.id, "2026-09-22");
    s.exercises[0].sets[0] = { id: "a", weight: 30, reps: 10, done: true };
    s.exercises[0].sets[1] = { id: "b", weight: 100, reps: 20, done: false };
    p.days[0].exercises[0].weight = 99;
    expect(s.exercises[0].sets[0].weight).toBe(30);
    expect(volume(s)).toBe(300);
    s.exercises[0].sets[0].weight = 0;
    expect(volume(s)).toBe(0);
  });
  it("gera histórico coerente e hoje parcial relativo à primeira abertura", () => {
    const d = createDemo("2026-09-22");
    expect(
      d.meals.every((m) => m.date >= "2026-06-25" && m.date <= "2026-09-22"),
    ).toBe(true);
    expect(d.meals.filter((m) => m.date === "2026-09-22")).toHaveLength(2);
    expect(d.plans.filter((p) => p.active)).toHaveLength(1);
    expect(d.measurements.length).toBeGreaterThan(10);
    expect(d.sessions.every((s) => Boolean(s.finishedAt))).toBe(true);
    const empty = blankData("new@exemplo.com", "Novo");
    expect(empty.meals).toHaveLength(0);
    expect(empty.profile.onboarded).toBe(false);
  });
  it("converte unidades de ida e volta sem alterar o valor interno", () => {
    expect(
      weightInternal(weightDisplay(78.4, "imperial"), "imperial"),
    ).toBeCloseTo(78.4, 8);
    expect(
      lengthInternal(lengthDisplay(175, "imperial"), "imperial"),
    ).toBeCloseTo(175, 8);
    expect(weightDisplay(78.4, "metric")).toBe(78.4);
  });
});

describe("diferenças calóricas", () => {
  it("separa apenas o excedente e mantém dias sem meta sem comparação", () => {
    expect(calorieBalance(2300, 2000)).toEqual({
      withinGoal: 2000,
      excess: 300,
      below: 0,
    });
    expect(calorieBalance(1700, 2000)).toEqual({
      withinGoal: 1700,
      excess: 0,
      below: 300,
    });
    expect(calorieBalance(2000, 2000)).toEqual({
      withinGoal: 2000,
      excess: 0,
      below: 0,
    });
    expect(calorieBalance(2300, null)).toEqual({
      withinGoal: 2300,
      excess: 0,
      below: null,
    });
  });
  it("soma por dia encerrado com meta histórica, sem compensar diferenças", () => {
    const d = blankData("teste@local.com", "Teste");
    d.goals = [
      {
        date: "2025-12-30",
        calories: 2000,
        protein: 100,
        carbs: 200,
        fat: 60,
        frequency: 3,
      },
      {
        date: "2026-01-01",
        calories: 1800,
        protein: 100,
        carbs: 200,
        fat: 60,
        frequency: 3,
      },
    ];
    d.meals = [
      ["2025-12-29", 100],
      ["2025-12-30", 2100],
      ["2025-12-31", 1800],
      ["2026-01-01", 2300],
      ["2026-01-02", 0],
      ["2026-01-05", 9999],
      ["2026-01-06", 9999],
    ].map(([date, calories], i) => ({
      id: String(i),
      date: String(date),
      time: "12:00",
      type: "Almoço",
      items: [food("Refeição", Number(calories), 0, 0, 0)],
    }));
    d.meals.push({
      id: "empty",
      date: "2026-01-03",
      time: "12:00",
      type: "Almoço",
      items: [],
    });
    d.confirmedFoodDays = d.meals.map((m) => m.date);
    const week = periodStats(
      d,
      periodDates("2026-01-01", "week"),
      "2026-01-05",
    );
    expect(week.excessCalories).toBe(600);
    expect(week.belowCalories).toBe(2000);
    expect(week.daysAbove).toBe(2);
    expect(week.daysBelow).toBe(2);
    expect(week.denominator).toBe(4);
    const month = periodStats(
      d,
      periodDates("2026-01-05", "month"),
      "2026-01-05",
    );
    expect(month.excessCalories).toBe(500);
    expect(month.belowCalories).toBe(1800);
    expect(month.denominator).toBe(2);
    const todayOnly = periodStats(d, ["2026-01-05"], "2026-01-05");
    expect(todayOnly.excessCalories).toBe(0);
    expect(todayOnly.belowCalories).toBe(0);
    expect(todayOnly.denominator).toBe(0);
    d.meals[1].items[0].calories = 1900;
    expect(
      periodStats(d, periodDates("2026-01-01", "week"), "2026-01-05")
        .belowCalories,
    ).toBe(2100);
    d.meals = d.meals.filter((m) => m.date !== "2025-12-31");
    expect(
      periodStats(d, periodDates("2026-01-01", "week"), "2026-01-05")
        .belowCalories,
    ).toBe(1900);
  });
});
