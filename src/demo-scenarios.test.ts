import { describe, expect, it } from "vitest";
import { createDemoScenario } from "./demo-scenarios";
import { dayMacros, goalAt, periodDates, shiftDate } from "./domain";

describe("cenários de demonstração", () => {
  const anchor = "2026-09-22";
  it("conta nova começa vazia e precisa concluir onboarding", () => {
    const { data, route } = createDemoScenario("new", anchor);
    expect(route).toBe("/onboarding");
    expect(data.profile.onboarded).toBe(false);
    expect(data.meals).toEqual([]);
  });
  it("semana incompleta separa dois dias confirmados de dois parciais e três vazios", () => {
    const { data } = createDemoScenario("incomplete", anchor);
    const dates = periodDates(shiftDate(anchor, -7), "week");
    expect(
      dates.filter((date) => data.confirmedFoodDays?.includes(date)),
    ).toHaveLength(2);
    expect(
      dates.filter((date) => data.meals.some((meal) => meal.date === date)),
    ).toHaveLength(4);
  });
  it("excesso corresponde a 400 kcal num dia confirmado", () => {
    const { data } = createDemoScenario("excess", anchor);
    const date = shiftDate(anchor, -1);
    expect(dayMacros(data, date).calories - goalAt(data, date)!.calories).toBe(
      400,
    );
    expect(data.confirmedFoodDays).toContain(date);
  });
  it("treino interrompido preserva uma série concluída e as seguintes abertas", () => {
    const { data } = createDemoScenario("workout", anchor);
    const running = data.sessions.filter((session) => !session.finishedAt);
    expect(running).toHaveLength(1);
    expect(running[0].exercises[0].sets[0]).toMatchObject({
      done: true,
      reps: 10,
    });
    expect(running[0].exercises[0].sets[1].done).toBe(false);
  });
  it("relógio está conectado mas ainda não sincronizou", () => {
    const { data } = createDemoScenario("watch", anchor);
    expect(data.energyConnection?.provider).toBe("watch");
    expect(data.energyConnection?.syncedAt).toBeUndefined();
    expect(data.energy).toEqual([]);
  });
});
