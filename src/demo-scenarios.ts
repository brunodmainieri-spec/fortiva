import {
  blankData,
  createDemo,
  food,
  goalAt,
  MEAL_TYPES,
  periodDates,
  shiftDate,
  startSession,
  today,
  uid,
} from "./domain";
import type { AppData, Meal } from "./domain";

export const demoScenarios = [
  {
    id: "new",
    name: "Conta nova",
    description:
      "Comece pelo cadastro de dados, metas e rotina, com o histórico vazio.",
  },
  {
    id: "incomplete",
    name: "Semana incompleta",
    description:
      "Veja uma semana com dias confirmados, registros incompletos e dias sem dados.",
  },
  {
    id: "excess",
    name: "Dia acima da meta",
    description:
      "Confira um dia encerrado com 400 kcal acima da meta e os destaques de excesso.",
  },
  {
    id: "workout",
    name: "Treino interrompido",
    description:
      "Retome uma sessão com séries já concluídas e confira a preservação dos valores.",
  },
  {
    id: "watch",
    name: "Relógio sem sincronização",
    description:
      "Explore a conexão simulada de um relógio que ainda não importou registros.",
  },
] as const;
export type DemoScenario = (typeof demoScenarios)[number]["id"];

export function createDemoScenario(
  scenario: DemoScenario,
  anchor = today(),
): { data: AppData; route: string } {
  if (scenario === "new")
    return {
      data: blankData("alex@exemplo.com", "Alex Morgan"),
      route: "/onboarding",
    };
  const data = createDemo(anchor);
  if (scenario === "incomplete") {
    const dates = periodDates(shiftDate(anchor, -7), "week");
    const template = data.meals.find((meal) => meal.items.length > 0)!;
    data.meals = data.meals.filter((meal) => !dates.includes(meal.date));
    const kinds: Meal["type"][] = [...MEAL_TYPES].slice(0, 4);
    dates.slice(0, 4).forEach((date, day) => {
      const count = day < 2 ? 4 : 1;
      kinds.slice(0, count).forEach((type) =>
        data.meals.push({
          ...template,
          id: uid(),
          date,
          type,
          items: template.items.map((item) => ({ ...item, id: uid() })),
        }),
      );
    });
    data.confirmedFoodDays = [
      ...(data.confirmedFoodDays ?? []).filter((date) => !dates.includes(date)),
      dates[0],
      dates[1],
    ];
    return { data, route: `/evolucao?tab=diet&period=week&date=${dates[0]}` };
  }
  if (scenario === "excess") {
    const date = shiftDate(anchor, -1);
    const calories = (goalAt(data, date)?.calories ?? 2200) + 400;
    data.meals = data.meals.filter((meal) => meal.date !== date);
    ([...MEAL_TYPES].slice(0, 4) as Meal["type"][]).forEach((type, index) =>
      data.meals.push({
        id: uid(),
        date,
        time: ["08:00", "12:30", "16:00", "20:00"][index],
        type,
        items: [food("Refeição ilustrativa", calories / 4, 45, 80, 25)],
      }),
    );
    data.confirmedFoodDays = [
      ...new Set([...(data.confirmedFoodDays ?? []), date]),
    ];
    return { data, route: `/?date=${date}` };
  }
  if (scenario === "workout") {
    const plan = data.plans.find((item) => item.active)!;
    const session = startSession(plan.days[0], plan.id, anchor);
    session.startedAt = new Date(Date.now() - 8 * 60_000).toISOString();
    session.exercises[0].sets[0].done = true;
    session.exercises[0].sets[0].reps = 10;
    data.sessions.push(session);
    return { data, route: "/treinos" };
  }
  data.energy = [];
  data.energyConnection = {
    provider: "watch",
    connectedAt: new Date().toISOString(),
  };
  return { data, route: "/evolucao?tab=energy" };
}
