import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function demo(page: Page) {
  await page.clock.setFixedTime(new Date("2026-09-22T15:00:00Z"));
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.locator("main h1")).toContainText("Alex");
}
test("explicação contextual, perguntas e links usam os registros sem alterá-los", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/evolucao?tab=energy&period=week&date=2026-09-21");
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  await page
    .getByRole("button", {
      name: "Entender este resultado: Saldo energético",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".assistant-answer")).toContainText(
    "consumo e gasto total",
  );
  await expect(dialog.locator(".assistant-context")).toContainText(
    "2026-09-21 → 2026-09-22",
  );
  await dialog
    .getByRole("button", {
      name: "Como o basal entra nesta comparação?",
      exact: true,
    })
    .click();
  await expect(dialog.locator(".assistant-answer")).toHaveCount(2);
  await expect(dialog.locator(".assistant-answer").last()).toContainText(
    "apenas repouso",
  );
  await dialog.getByLabel("Sua pergunta").fill("Explique melhor");
  await dialog
    .getByRole("button", { name: "Enviar pergunta", exact: true })
    .click();
  await expect(dialog.locator(".assistant-answer")).toHaveCount(3);
  await expect(
    dialog.locator(".assistant-answer").last().getByRole("heading"),
  ).toHaveText("Metabolismo basal");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before);
  await dialog
    .getByRole("button", { name: "Revisar gasto de energia", exact: true })
    .last()
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/date=2026-09-22#registros-energia/);
  await expect(page.locator("#registros-energia")).toHaveAttribute("open", "");
});
test("conversa mobile é acessível, contém fallback e devolve foco", async ({
  page,
}) => {
  await demo(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page
    .getByRole("button", { name: "Abrir assistente", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".assistant-answer")).toBeVisible();
  await dialog
    .getByLabel("Sua pergunta")
    .fill("<script>alert('teste')</script>");
  await dialog.getByLabel("Sua pergunta").press("Enter");
  await expect(dialog.locator(".assistant-answer").last()).toContainText(
    "não interpreto qualquer pergunta",
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog.screenshot({ path: "artifacts/assistant-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir assistente", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Abrir assistente", exact: true })
    .click();
  await expect(dialog.locator(".assistant-answer")).toHaveCount(2);
  await dialog
    .getByRole("button", { name: "Limpar conversa", exact: true })
    .click();
  await expect(dialog.locator(".assistant-turn")).toHaveCount(0);
});
test("falha recuperável, cancelamento e saída não deixam respostas antigas", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/?fail=assistant");
  await page
    .getByRole("button", { name: "Abrir assistente", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText(
    "pergunta foi preservada",
  );
  await dialog
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(dialog.locator(".assistant-answer")).toHaveCount(1);
  await expect(dialog.locator(".assistant-question")).toHaveCount(1);
  await dialog.getByLabel("Sua pergunta").fill("Como foi este período?");
  await dialog.getByLabel("Sua pergunta").press("Enter");
  await dialog
    .getByRole("button", { name: "Interromper", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("interrompida");
  await dialog
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(dialog.locator(".assistant-answer")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page
    .getByRole("button", { name: "Abrir assistente", exact: true })
    .click();
  await expect(page.locator(".assistant-answer")).toHaveCount(1);
});
test("macros e exercício selecionado entram no contexto correto", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("button", {
      name: "Entender este resultado: Macronutrientes",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".assistant-answer")).toContainText(
    "parte escura",
  );
  await page.keyboard.press("Escape");
  await page.goto("/evolucao?tab=training&period=month&date=2026-09-22");
  const select = page.locator("select").first();
  await expect(select).toBeVisible();
  const options = await select.locator("option").allTextContents();
  await select.selectOption({ label: options.at(-1)! });
  await page
    .getByRole("button", {
      name: "Entender este resultado: Evolução de cargas",
      exact: true,
    })
    .click();
  await expect(dialog.locator(".assistant-answer")).toContainText(
    "sessões concluídas",
  );
  await dialog
    .getByText("Dados usados nesta resposta", { exact: true })
    .click();
  await expect(dialog.locator(".assistant-answer")).toContainText(
    options.at(-1)!,
  );
});
