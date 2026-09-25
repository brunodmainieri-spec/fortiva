import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const key = "asimov-fit:v1:alex@exemplo.com";
async function expand(page: Page, title: string) {
  const summary = page.locator("summary").filter({ hasText: title });
  const details = summary.locator("..");
  if ((await details.getAttribute("open")) === null) await summary.click();
  await expect(details).toHaveAttribute("open", "");
}
async function start(page: Page) {
  await page.clock.setFixedTime(new Date("2026-09-22T15:00:00Z"));
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await page.evaluate((key) => {
    const d = JSON.parse(localStorage.getItem(key)!);
    d.energy = [];
    d.confirmedFoodDays = ["2026-09-21"];
    delete d.energyConnection;
    d.meals = [
      {
        id: "m",
        date: "2026-09-21",
        time: "12:00",
        type: "Almoço",
        items: [
          {
            id: "f",
            name: "Teste",
            portion: 100,
            unit: "g",
            calories: 2000,
            protein: 100,
            carbs: 200,
            fat: 60,
          },
        ],
      },
    ];
    d.measurements = [
      { id: "1", date: "2026-09-20", weight: 80, waist: 0, arm: 0 },
      { id: "2", date: "2026-09-22", weight: 79.5, waist: 0, arm: 0 },
    ];
    localStorage.setItem(key, JSON.stringify(d));
  }, key);
}
const value = (page: Page, label: string) =>
  page
    .locator(".stat-card")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator(".stat-value");
const stored = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);

test("registro manual, erro de gravação, saldo, peso, edição e exclusão", async ({
  page,
}) => {
  await start(page);
  await page.goto("/evolucao?tab=energy&fail=storage");
  await expect(
    page.getByRole("heading", { name: "Seu gasto de energia", exact: true }),
  ).toBeVisible();
  await expect(value(page, "Saldo energético")).toHaveText("—");
  await expand(page, "Detalhes do balanço e do peso");
  await expect(value(page, "Variação registrada na balança")).toHaveText(
    "−0,5kg",
  );
  await page
    .getByRole("button", { name: "Registrar gasto", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Data do gasto").fill("21/09/2026");
  await dialog.getByLabel(/^Calorias de atividade/).fill("500");
  await dialog.getByLabel(/^Tempo de atividade/).fill("45");
  await dialog.getByLabel(/^Gasto total diário/).fill("2500");
  await dialog.getByRole("button", { name: "Salvar gasto" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel(/^Gasto total diário/)).toHaveValue("2500");
  await dialog.getByRole("button", { name: "Salvar gasto" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(value(page, "Déficit energético")).toHaveText("500kcal");
  await expect(value(page, "Saldo energético")).toHaveText("−500kcal");
  await expect(value(page, "Equivalente teórico em peso")).toHaveText(
    "−0,06kg",
  );
  await page.goto("/evolucao?tab=energy");
  await expand(page, "Detalhes do balanço e do peso");
  await expand(page, "Registros de energia");
  await expect(value(page, "Déficit energético")).toHaveText("500kcal");
  await page.getByRole("button", { name: /Editar gasto de/ }).click();
  await dialog.getByLabel(/^Gasto total diário/).fill("1800");
  await dialog.getByRole("button", { name: "Salvar gasto" }).click();
  await expect(value(page, "Superávit energético")).toHaveText("200kcal");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/energia-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Excluir gasto de/ }).click();
  await expect(value(page, "Saldo energético")).toHaveText("—");
});

test("conexão simulada, revisão, reimportação e fonte sem gasto total", async ({
  page,
}) => {
  await start(page);
  await page.goto("/evolucao?tab=energy&fail=wearable");
  await expand(page, "Fontes de dados e dispositivos");
  await page.getByRole("button", { name: "Simular conexão" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect((await stored(page)).energyConnection).toBeUndefined();
  await page.getByRole("button", { name: "Simular conexão" }).click();
  await expect(
    page
      .locator(".energy-connection-state")
      .getByText("Garmin · conexão simulada", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Importar exemplo de 7 dias" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await stored(page)).energy).toEqual([]);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Importar exemplo de 7 dias" })
    .click();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await stored(page)).energy).toHaveLength(7);
  await page
    .getByRole("button", { name: "Importar exemplo de 7 dias" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "7 datas já possuem registros",
  );
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await stored(page)).energy).toHaveLength(7);
  await page.goto("/evolucao?tab=energy");
  await expand(page, "Fontes de dados e dispositivos");
  await expect(
    page
      .locator(".energy-connection-state")
      .getByText("Garmin · conexão simulada", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Desconectar", exact: true }).click();
  await page.getByLabel("Fonte de energia").selectOption("strava");
  await page.getByRole("button", { name: "Simular conexão" }).click();
  await page
    .getByRole("button", { name: "Importar exemplo de 7 dias" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "não informa gasto total",
  );
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(value(page, "Saldo energético")).toHaveText("—");
  expect((await stored(page)).energy).toHaveLength(7);
  await expand(page, "Registros de energia");
  await expand(page, "Detalhes do balanço e do peso");
  await page.getByRole("button", { name: /Editar gasto de 21/ }).click();
  await page.getByLabel("Tenho o gasto total diário").check();
  await page
    .getByRole("dialog")
    .getByLabel(/^Gasto total diário/)
    .fill("2500");
  await page.getByRole("button", { name: "Salvar gasto" }).click();
  await expect(value(page, "Déficit energético")).toHaveText("500kcal");
});

test("perfis anteriores recebem energia sem perder os registros existentes", async ({
  page,
}) => {
  await start(page);
  const before = await stored(page);
  await page.evaluate((key) => {
    const d = JSON.parse(localStorage.getItem(key)!);
    delete d.energy;
    localStorage.setItem(key, JSON.stringify(d));
  }, key);
  await page.goto("/evolucao?tab=energy");
  await expand(page, "Fontes de dados e dispositivos");
  await expect(page.getByText(/Este período contém/)).toBeVisible();
  await page.getByRole("button", { name: "Simular conexão" }).click();
  await expect(
    page
      .locator(".energy-connection-state")
      .getByText("Garmin · conexão simulada", { exact: true }),
  ).toBeVisible();
  const after = await stored(page);
  expect(after.energy).toHaveLength(90);
  expect(after.meals).toEqual(before.meals);
  expect(after.measurements).toEqual(before.measurements);
  expect(after.goals).toEqual(before.goals);
  expect(after.plans).toEqual(before.plans);
  await page.screenshot({
    path: "artifacts/energia-desktop.png",
    fullPage: true,
  });
});
