import { test, expect } from "@playwright/test";

test("excedente vermelho e somas separadas respeitam datas e metas", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-22T15:00:00Z"));
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.getByRole("heading", { name: /Olá, Alex/ })).toBeVisible();
  await page.evaluate(() => {
    const key = "asimov-fit:v1:alex@exemplo.com";
    const d = JSON.parse(localStorage.getItem(key)!);
    d.confirmedFoodDays = ["2026-09-19", "2026-09-20", "2026-09-21"];
    d.goals = [
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
        protein: 100,
        carbs: 200,
        fat: 60,
        frequency: 3,
      },
    ];
    d.meals = [
      ["2026-09-19", "08:00", 1500],
      ["2026-09-19", "12:00", 800],
      ["2026-09-20", "12:00", 1700],
      ["2026-09-21", "12:00", 2000],
      ["2026-09-22", "12:00", 3000],
    ].map(([date, time, calories], i) => ({
      id: `meal-${i}`,
      date,
      time,
      type: "Almoço",
      items: [
        {
          id: `item-${i}`,
          name: "Refeição teste",
          portion: 100,
          unit: "g",
          calories,
          protein: 100,
          carbs: 200,
          fat: 60,
        },
      ],
    }));
    localStorage.setItem(key, JSON.stringify(d));
  });
  await page.goto("/evolucao");
  const summary = page.getByRole("region", {
    name: "Balanço calórico do período",
  });
  const above = summary.locator(".calorie-excess .stat-value");
  const below = summary.locator(".calorie-below .stat-value");
  await expect(above).toHaveText("500kcal");
  await expect(below).toHaveText("300kcal");
  await expect(above).toHaveCSS("color", "rgb(255, 133, 133)");
  const chart = page.locator(".chart-card").first();
  await expect(
    chart.locator('.recharts-bar-rectangle path[fill="#ff8585"]').first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dia", exact: true }).click();
  await expect(above).toHaveText("—");
  await page.getByLabel("Data de referência").fill("19/09/2026");
  await expect(above).toHaveText("300kcal");
  await expect(below).toHaveText("0kcal");
  await expect(
    chart.locator('.recharts-bar-rectangle path[fill="#ff8585"]'),
  ).toHaveCount(1);
  await chart.locator('.recharts-bar-rectangle path[fill="#ff8585"]').hover();
  await expect(page.locator(".calorie-tooltip")).toContainText(
    "Consumido: 800 kcal",
  );
  await expect(page.locator(".calorie-tooltip")).toContainText(
    "Acima da meta: 300 kcal",
  );
  await page.getByLabel("Data de referência").fill("18/09/2026");
  await expect(above).toHaveText("—");
  await expect(below).toHaveText("—");
  await page.getByRole("button", { name: "Mês", exact: true }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/calorias-mobile.png",
    fullPage: true,
  });
  await page.goto("/?date=2026-09-19");
  await expect(page.locator(".ring-excess")).toBeVisible();
  await expect(page.locator(".calorie-over-goal > strong")).toHaveText(
    "300kcal",
  );
  await page.getByRole("button", { name: "Editar Almoço" }).first().click();
  await page
    .getByRole("dialog")
    .getByLabel(/^Calorias/)
    .fill("1000");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Concluí os registros do dia",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/evolucao");
  await expect(above).toHaveText("200kcal");
  await expect(below).toHaveText("300kcal");
  await page.goto("/?date=2026-09-19");
  await page
    .getByRole("button", { name: "Concluí os registros do dia", exact: true })
    .click();
  await expect(page.getByText("Dia confirmado", { exact: true })).toBeVisible();
  await page.goto("/evolucao");
  await expect(above).toHaveText("200kcal");
  await expect(below).toHaveText("500kcal");
});
