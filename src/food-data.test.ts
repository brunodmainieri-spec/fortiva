import { describe, expect, it } from "vitest";
import { blankData, food, periodDates, periodStats } from "./domain";
import { energyStats } from "./energy-domain";
import { cloneFoods, recentFoods, removeMeal, saveMeal } from "./food-data";

describe("confirmação alimentar e atalhos", () => {
  function fixture() {
    const d = blankData("teste@local", "Teste");
    d.goals = [
      {
        date: "2025-12-01",
        calories: 2000,
        protein: 100,
        carbs: 200,
        fat: 60,
        frequency: 0,
      },
    ];
    d.meals = ["2025-12-31", "2026-01-01", "2026-01-02"].map((date, i) => ({
      id: String(i),
      date,
      time: "12:00",
      type: "Almoço",
      items: [food("Arroz", 1000 + i * 1000, 20, 40, 10)],
    }));
    d.energy = d.meals.map((m) => ({
      id: m.id,
      date: m.date,
      totalCalories: 2500,
      activeCalories: 100,
      minutes: 30,
      source: "manual" as const,
      simulated: false,
      updatedAt: "",
    }));
    return d;
  }
  it("não interpreta um dia passado incompleto como déficit; respeita virada de mês", () => {
    const d = fixture();
    let s = periodStats(d, periodDates("2026-01-01", "week"), "2026-01-02");
    expect(s.recorded).toBe(3);
    expect(s.denominator).toBe(0);
    expect(s.belowCalories).toBe(0);
    expect(
      energyStats(d, periodDates("2026-01-01", "week"), "2026-01-02").net,
    ).toBeNull();
    d.confirmedFoodDays = ["2025-12-31", "2026-01-01", "2026-01-02"];
    s = periodStats(d, periodDates("2026-01-01", "week"), "2026-01-02");
    expect(s.denominator).toBe(2);
    expect(s.belowCalories).toBe(1000);
    expect(
      periodStats(d, periodDates("2026-01-01", "month"), "2026-01-02")
        .denominator,
    ).toBe(1);
    expect(
      energyStats(d, periodDates("2026-01-01", "week"), "2026-01-02").net,
    ).toBe(-2000);
  });
  it("editar data reabre origem e destino; exclusão remove só o rascunho correspondente", () => {
    const d = fixture();
    d.confirmedFoodDays = d.meals.map((m) => m.date);
    d.mealDrafts = {
      "0": { meal: d.meals[0], mode: "manual", photo: "", analyzed: false },
      new: { meal: d.meals[1], mode: "manual", photo: "", analyzed: false },
    };
    const changed = saveMeal(d, { ...d.meals[0], date: "2026-01-01" }, "0");
    expect(changed.confirmedFoodDays).toEqual(["2026-01-02"]);
    expect(changed.mealDrafts?.new).toBeDefined();
    expect(changed.mealDrafts?.["0"]).toBeUndefined();
    const removed = removeMeal(d, d.meals[0]);
    expect(removed.meals).toHaveLength(2);
    expect(removed.confirmedFoodDays).not.toContain("2025-12-31");
    expect(d.meals).toHaveLength(3);
  });
  it("recentes prioriza última porção e repetir gera itens independentes", () => {
    const d = fixture();
    const foods = recentFoods(d);
    expect(foods).toHaveLength(1);
    expect(foods[0].calories).toBe(3000);
    const copy = cloneFoods(foods);
    expect(copy[0].id).not.toBe(foods[0].id);
    copy[0].calories = 7;
    expect(foods[0].calories).toBe(3000);
  });
});
