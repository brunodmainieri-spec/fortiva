import { describe, expect, it } from "vitest";
import {
  blankData,
  createDemo,
  food,
  periodDates,
  sampleEnergy,
  shiftDate,
  today,
} from "./domain";
import type { EnergyEntry } from "./domain";
import { energyStats, mergeEnergy, validateEnergy } from "./energy-domain";
const entry = (
  date: string,
  totalCalories: number | null,
  activeCalories = 500,
): EnergyEntry => ({
  id: date,
  date,
  totalCalories,
  activeCalories,
  minutes: 45,
  source: "manual",
  simulated: false,
  updatedAt: "",
});

describe("gasto e balanço energético", () => {
  it("usa gasto total sem adicionar atividade novamente, exclui hoje e dados ausentes", () => {
    const d = blankData("a@b.com", "A");
    d.energy = [
      entry("2026-09-18", 2500),
      entry("2026-09-19", 1800),
      entry("2026-09-20", null),
      entry("2026-09-21", 2300),
      entry("2026-09-22", 3000),
      entry("2026-09-23", 5000),
    ];
    d.meals = [
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
      "2026-09-22",
      "2026-09-23",
    ].map((date) => ({
      id: date,
      date,
      time: "12:00",
      type: "Almoço",
      items: [food("Alimento", 2000, 0, 0, 0)],
    }));
    d.confirmedFoodDays = d.meals.map((m) => m.date);
    const stats = energyStats(
      d,
      periodDates("2026-09-22", "month"),
      "2026-09-22",
    );
    expect(stats.deficit).toBe(500);
    expect(stats.surplus).toBe(200);
    expect(stats.net).toBe(-300);
    expect(stats.theoreticalKg).toBeCloseTo(-300 / 7700);
    expect(stats.comparableDays).toBe(2);
    expect(stats.active).toBe(2500);
    expect(stats.total).toBe(9600);
    expect(stats.totalDays).toBe(4);
    expect(stats.rows.find((r) => r.date === "2026-09-20")?.balance).toBeNull();
    expect(stats.observed).toBeNull();
    d.measurements = [
      { id: "1", date: "2026-09-18", weight: 80, arm: 0, waist: 0 },
      { id: "2", date: "2026-09-22", weight: 79.5, arm: 0, waist: 0 },
    ];
    expect(
      energyStats(d, periodDates("2026-09-22", "month"), "2026-09-22").observed,
    ).toEqual({ kg: -0.5, from: "2026-09-18", to: "2026-09-22" });
  });
  it("distingue saldo zero, ausência de dados e consumo zero registrado", () => {
    const d = blankData("a@b.com", "A");
    d.energy = [entry("2026-01-01", 2000)];
    const dates = periodDates("2026-01-01", "day");
    expect(energyStats(d, dates, "2026-01-02").net).toBeNull();
    d.meals = [
      {
        id: "m",
        date: "2026-01-01",
        time: "12:00",
        type: "Almoço",
        items: [food("A", 2000, 0, 0, 0)],
      },
    ];
    d.confirmedFoodDays = ["2026-01-01"];
    expect(energyStats(d, dates, "2026-01-02").net).toBe(0);
    d.meals[0].items[0].calories = 0;
    expect(energyStats(d, dates, "2026-01-02").deficit).toBe(2000);
    d.meals[0].items = [];
    expect(energyStats(d, dates, "2026-01-02").comparableDays).toBe(0);
  });
  it("importações repetidas substituem a data sem duplicar fontes", () => {
    const old = entry("2025-12-31", 2500);
    const next = {
      ...old,
      id: "import",
      source: "strava" as const,
      totalCalories: null,
    };
    const merged = mergeEnergy([old, entry("2026-01-01", 2200)], [next]);
    expect(merged).toHaveLength(2);
    expect(mergeEnergy(merged, [next])).toEqual(merged);
    expect(merged.find((e) => e.date === old.date)?.totalCalories).toBeNull();
    const d = blankData("a@b.com", "A");
    d.energy = merged;
    expect(
      energyStats(d, periodDates("2026-01-01", "month"), "2026-01-02").total,
    ).toBe(2200);
    expect(
      energyStats(d, periodDates("2026-01-01", "week"), "2026-01-02").active,
    ).toBe(1000);
  });
  it("valida datas, valores negativos e total menor que atividade", () => {
    expect(() => validateEnergy(entry(today(), 2500))).not.toThrow();
    expect(() => validateEnergy(entry(today(), null))).not.toThrow();
    expect(() => validateEnergy(entry(today(), 100))).toThrow();
    expect(() => validateEnergy(entry(today(), NaN))).toThrow();
    expect(() => validateEnergy(entry(today(), 2500, -1))).toThrow();
    expect(() =>
      validateEnergy({ ...entry(today(), 2500), minutes: 1441 }),
    ).toThrow();
    expect(() => validateEnergy(entry(shiftDate(today(), 1), 2500))).toThrow();
    expect(() => validateEnergy(entry("2026-02-30", 2500))).toThrow();
  });
  it("cadastro começa vazio e demonstração recebe histórico relativo à abertura", () => {
    expect(blankData("a@b.com", "A").energy).toEqual([]);
    const demo = createDemo("2026-09-22");
    expect(demo.energy).toHaveLength(90);
    expect(
      demo.energy.every(
        (e) => e.simulated && e.totalCalories! >= e.activeCalories,
      ),
    ).toBe(true);
    expect(sampleEnergy("2026-09-22", 7).map((e) => e.date)).toContain(
      "2026-09-16",
    );
  });
});
