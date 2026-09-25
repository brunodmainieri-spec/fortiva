import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const key = "asimov-fit:v1:alex@exemplo.com";
const card = (page: import("@playwright/test").Page, label: string) =>
  page
    .locator(".stat-card")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator(".stat-value");

test("basal no perfil, referência diária, prioridade do relógio e histórico", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-22T15:00:00Z"));
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await page.goto("/perfil");
  await page
    .getByLabel("Cálculo basal no gasto diário")
    .selectOption("automatic");
  await expect(page.locator(".basal-result")).toContainText("1.743");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Perfil e metas atualizados",
  );
  await page.goto("/evolucao?tab=energy");
  await page
    .locator("summary")
    .filter({ hasText: "Metabolismo basal" })
    .click();
  await expect(card(page, "Referência basal diária")).toHaveText(
    "1.743kcal/dia",
  );
  await expect(card(page, "Basal usado no período")).toHaveText("—");
  await page.evaluate((key) => {
    const d = JSON.parse(localStorage.getItem(key)!);
    d.energy = [];
    d.confirmedFoodDays = ["2026-09-22"];
    d.meals = [
      {
        id: "m",
        date: "2026-09-22",
        time: "12:00",
        type: "Almoço",
        items: [
          {
            id: "f",
            name: "Teste",
            portion: 100,
            unit: "g",
            calories: 2000,
            protein: 0,
            carbs: 0,
            fat: 0,
          },
        ],
      },
    ];
    localStorage.setItem(key, JSON.stringify(d));
  }, key);
  await page.reload();
  await page
    .locator("summary")
    .filter({ hasText: "Metabolismo basal" })
    .click();
  await expect(card(page, "Basal usado no período")).toHaveText("1.743kcal");
  await expect(card(page, "Saldo em relação ao basal")).toHaveText("—");
  await expect(card(page, "Saldo energético")).toHaveText("—");
  await page.clock.setFixedTime(new Date("2026-09-23T15:00:00Z"));
  await page.reload();
  await page
    .locator("summary")
    .filter({ hasText: "Metabolismo basal" })
    .click();
  await expect(card(page, "Saldo em relação ao basal")).toHaveText("+257kcal");
  await page
    .locator("summary")
    .filter({ hasText: "Detalhes do balanço e do peso" })
    .click();
  await expect(card(page, "Equivalente teórico em peso")).toHaveText("—");
  await page
    .getByRole("button", { name: "Configurar basal", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Cálculo basal no gasto diário")
    .selectOption("manual");
  await dialog.getByLabel(/^Metabolismo basal manual/).fill("1600");
  await dialog.getByRole("button", { name: "Salvar referência basal" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(card(page, "Referência basal diária")).toHaveText(
    "1.600kcal/dia",
  );
  await expect(card(page, "Saldo em relação ao basal")).toHaveText("+257kcal");
  await page.goto("/perfil");
  await expect(page.getByLabel("Cálculo basal no gasto diário")).toHaveValue(
    "manual",
  );
  await expect(page.getByLabel(/^Metabolismo basal manual/)).toHaveValue(
    "1600",
  );
  await page.goto("/evolucao?tab=energy");
  await page
    .locator("summary")
    .filter({ hasText: "Metabolismo basal" })
    .click();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Configurar basal", exact: true })
    .click();
  await expect(dialog).toHaveCSS("opacity", "1");
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await dialog.getByLabel("Cálculo basal no gasto diário").selectOption("off");
  await dialog.getByRole("button", { name: "Salvar referência basal" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(card(page, "Referência basal diária")).toHaveText("—");
  await expect(card(page, "Basal usado no período")).toHaveText("1.743kcal");
  await expect(card(page, "Saldo em relação ao basal")).toHaveText("+257kcal");
});
