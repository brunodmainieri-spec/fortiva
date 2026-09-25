import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const key = "asimov-fit:v1:alex@exemplo.com";
async function demo(page: Page) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.getByRole("heading", { name: /Olá, Alex/ })).toBeVisible();
}
test("evolução preserva filtros e posição ao abrir diário e voltar", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/evolucao?tab=diet&period=week");
  await expect(page.locator(".coverage-summary strong")).toContainText(
    "dias confirmados",
  );
  await page.getByRole("button", { name: "Período anterior" }).click();
  await expect(page).toHaveURL(/date=/);
  const url = page.url();
  const date = new URL(url).searchParams.get("date")!;
  await expect(page.getByLabel("Data de referência")).toHaveValue(
    date.split("-").reverse().join("/"),
  );
  await page
    .getByRole("button", { name: "Gasto de energia", exact: true })
    .click();
  await expect(page.getByLabel("Data de referência")).toHaveValue(
    date.split("-").reverse().join("/"),
  );
  await expect(page).toHaveURL(/period=week/);
  await page.getByRole("button", { name: "Alimentação", exact: true }).click();
  const open = page.getByRole("button", { name: /Abrir diário de/ }).first();
  await open.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  await open.click();
  await expect(page).toHaveURL(/\/?date=/);
  await page.goBack();
  await expect(page).toHaveURL(url);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(scroll - 60);
});
test("energia usa detalhes progressivos e registros viram cartões no celular", async ({
  page,
}) => {
  await demo(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/evolucao?tab=energy");
  await expect(page.locator(".energy-primary-stats .stat-card")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Configurar basal", exact: true }),
  ).not.toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Metabolismo basal" })
    .click();
  await page
    .getByRole("button", { name: "Configurar basal", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .locator("summary")
    .filter({ hasText: "Fontes de dados e dispositivos" })
    .click();
  await expect(
    page.getByRole("button", { name: "Simular conexão" }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Detalhes do balanço e do peso" })
    .click();
  await expect(
    page.getByText("Equivalente teórico em peso", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .locator("summary")
    .filter({ hasText: "Registros de energia" })
    .click();
  const row = page.locator(".table-card tbody tr").first();
  await expect(row).toBeVisible();
  expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe(
    "block",
  );
  await expect(row.locator('[data-label="Consumo"]')).toBeVisible();
});
test("excluir e desfazer gasto preserva os demais registros", async ({
  page,
}) => {
  await demo(page);
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).energy,
    key,
  );
  await page.goto("/evolucao?tab=energy");
  await page
    .locator("summary")
    .filter({ hasText: "Registros de energia" })
    .click();
  await page
    .getByRole("button", { name: /Excluir gasto de/ })
    .first()
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).energy.length,
        key,
      ),
    )
    .toBe(before.length - 1);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).energy.length,
        key,
      ),
    )
    .toBe(before.length);
  const restored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).energy,
    key,
  );
  expect(
    restored.sort((a: { id: string }, b: { id: string }) =>
      a.id.localeCompare(b.id),
    ),
  ).toEqual(
    before.sort((a: { id: string }, b: { id: string }) =>
      a.id.localeCompare(b.id),
    ),
  );
});
