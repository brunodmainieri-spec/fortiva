import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function openTraining(page: Page) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page.goto("/treinos");
  await expect(
    page.getByRole("heading", { name: "Treinos", exact: true }),
  ).toBeVisible();
}
async function stored(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("asimov-fit:v1:alex@exemplo.com")!),
  );
}
test("plano mantém rascunho ao fechar e recarregar, e só altera prescrição ao salvar", async ({
  page,
}) => {
  await openTraining(page);
  const count = (await stored(page)).plans.length;
  await page.getByRole("button", { name: "Criar plano", exact: true }).click();
  await page
    .getByLabel("Nome do plano", { exact: true })
    .fill("Plano em construção");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Continuar rascunho" }),
  ).toBeVisible();
  await page.reload();
  expect((await stored(page)).plans.length).toBe(count);
  await page.getByRole("button", { name: "Continuar rascunho" }).click();
  await expect(page.getByLabel("Nome do plano", { exact: true })).toHaveValue(
    "Plano em construção",
  );
  await page.getByRole("button", { name: "Salvar plano", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await stored(page)).plans.length).toBe(count + 1);
  expect((await stored(page)).planDraft).toBeUndefined();
  await page.getByRole("button", { name: "Criar plano", exact: true }).click();
  await page.getByLabel("Nome do plano", { exact: true }).fill("Descartar");
  await page.keyboard.press("Escape");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Descartar rascunho" }).click();
  await expect(
    page.getByRole("button", { name: "Continuar rascunho" }),
  ).toHaveCount(0);
});
test("execução destaca série atual, repete valores, recolhe exercício concluído e preserva ao recarregar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openTraining(page);
  await page
    .getByRole("button", { name: "Iniciar treino", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("region", { name: "Série atual" }),
  ).toBeVisible();
  const first = dialog.locator(".focused-exercise");
  await first.locator('input[aria-label^="Carga série 1"]').fill("43");
  await first.locator('input[aria-label^="Repetições série 1"]').fill("9");
  await page
    .getByRole("button", { name: "Concluir série atual", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Repetir valores da série anterior" })
    .click();
  await expect(first.locator('input[aria-label^="Carga série 2"]')).toHaveValue(
    "43",
  );
  await expect(
    first.locator('input[aria-label^="Repetições série 2"]'),
  ).toHaveValue("9");
  await page
    .getByRole("button", { name: "Concluir série atual", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Concluir série atual", exact: true })
    .click();
  const collapsed = dialog.locator(".session-exercise").first();
  await expect(
    collapsed.getByRole("button", { name: /Concluído/ }),
  ).toHaveAttribute("aria-expanded", "false");
  await collapsed.getByRole("button", { name: /Concluído/ }).click();
  await expect(collapsed.locator(".set-table")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Retomar treino", exact: true })
    .click();
  const session = (await stored(page)).sessions.find((s: any) => !s.finishedAt);
  expect(session.exercises[0].sets[1].weight).toBe(43);
  expect(session.exercises[0].sets[1].reps).toBe(9);
  expect(session.exercises[0].sets.every((s: any) => s.done)).toBeTruthy();
  const failures = await new AxeBuilder({ page })
    .include("dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(failures.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
