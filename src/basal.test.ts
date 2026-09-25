import { describe, expect, it } from "vitest";
import {
  blankData,
  calculateBasal,
  calculateGoals,
  food,
  initialProfile,
  periodDates,
} from "./domain";
import { basalForProfile, withBasalProfile } from "./basal";
import { energyStats } from "./energy-domain";

describe("metabolismo basal", () => {
  it("calcula apenas repouso sem fator de atividade ou ajuste de objetivo", () => {
    const p = { ...initialProfile(), age: 30, weight: 80, height: 180 };
    expect(calculateBasal(p)).toBe(1780);
    expect(calculateBasal({ ...p, coefficient: "female" })).toBe(1614);
    expect(calculateBasal({ ...p, goal: "bulking", activity: 1.9 })).toBe(1780);
    expect(calculateGoals(p).calories).toBe(Math.round(1780 * 1.55 * 0.9));
    expect(() => calculateBasal({ ...p, age: 17 })).toThrow();
    expect(() => calculateBasal({ ...p, weight: NaN })).toThrow();
    expect(() => calculateBasal({ ...p, coefficient: "manual" })).toThrow();
    expect(
      basalForProfile({ ...p, basalMode: "manual", basalManualCalories: 1650 }),
    ).toBe(1650);
    expect(() =>
      basalForProfile({ ...p, basalMode: "manual", basalManualCalories: -1 }),
    ).toThrow();
    expect(basalForProfile(p)).toBeNull();
  });
  it("salva referências por vigência e preserva o histórico ao atualizar ou desligar", () => {
    let d = blankData("a@b.com", "Teste");
    const p = {
      ...initialProfile(),
      basalMode: "manual" as const,
      basalManualCalories: 1700,
    };
    d = withBasalProfile(d, p, "2025-12-31");
    d = withBasalProfile(d, { ...p, basalManualCalories: 1600 }, "2026-01-01");
    d = withBasalProfile(d, { ...p, basalManualCalories: 1550 }, "2026-01-01");
    d = withBasalProfile(d, { ...p, basalMode: "off" }, "2026-01-02");
    expect(d.basalHistory).toHaveLength(3);
    const rows = energyStats(
      d,
      periodDates("2026-01-01", "week"),
      "2026-01-03",
    ).rows;
    expect(rows.find((r) => r.date === "2025-12-30")?.basal).toBeNull();
    expect(rows.find((r) => r.date === "2025-12-31")?.basal).toBe(1700);
    expect(rows.find((r) => r.date === "2026-01-01")?.basal).toBe(1550);
    expect(rows.find((r) => r.date === "2026-01-02")?.basal).toBeNull();
  });
  it("mantém o saldo basal separado e dá prioridade ao gasto total sem dupla contagem", () => {
    let d = blankData("a@b.com", "Teste");
    d = withBasalProfile(
      d,
      { ...initialProfile(), basalMode: "manual", basalManualCalories: 1700 },
      "2026-09-20",
    );
    d.confirmedFoodDays = ["2026-09-20", "2026-09-21", "2026-09-22"];
    d.meals = ["2026-09-20", "2026-09-21", "2026-09-22"].map((date) => ({
      id: date,
      date,
      time: "12:00",
      type: "Almoço",
      items: [food("Teste", 2000, 0, 0, 0)],
    }));
    d.energy = [
      {
        id: "1",
        date: "2026-09-21",
        totalCalories: 2500,
        activeCalories: 700,
        minutes: 45,
        source: "watch",
        simulated: true,
        updatedAt: "",
      },
      {
        id: "2",
        date: "2026-09-20",
        totalCalories: null,
        activeCalories: 300,
        minutes: 20,
        source: "strava",
        simulated: true,
        updatedAt: "",
      },
    ];
    const stats = energyStats(
      d,
      periodDates("2026-09-22", "month"),
      "2026-09-22",
    );
    expect(stats.basalDays).toBe(2);
    expect(stats.basalTotal).toBe(3400);
    expect(stats.basalComparedDays).toBe(1);
    expect(stats.basalNet).toBe(300);
    expect(stats.net).toBe(-500);
    expect(stats.theoreticalKg).toBeCloseTo(-500 / 7700);
    expect(stats.rows.find((r) => r.date === "2026-09-21")?.basal).toBeNull();
    d.energy = [];
    const onlyBasal = energyStats(d, ["2026-09-20"], "2026-09-22");
    expect(onlyBasal.net).toBeNull();
    expect(onlyBasal.theoreticalKg).toBeNull();
    expect(onlyBasal.basalNet).toBe(300);
  });
});
