import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("contraste e rótulos acessíveis nas telas principais e no editor", async ({
  page,
}) => {
  await page.goto("/entrar");
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.locator("main h1")).toBeVisible();
  for (const route of [
    "/",
    "/treinos",
    "/evolucao",
    "/evolucao?tab=body",
    "/evolucao?tab=energy",
    "/perfil",
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations, route).toEqual([]);
  }
  await page.goto("/");
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar refeição", exact: true }),
  ).toBeFocused();
});

test("editor de energia acessível no celular", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await page.goto("/evolucao?tab=energy");
  await page
    .getByRole("button", { name: "Registrar gasto", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar gasto", exact: true }),
  ).toBeFocused();
});
test("falha de armazenamento preserva formulário e permite nova tentativa", async ({
  page,
}) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adicionar alimento manualmente" })
    .click();
  await page.getByLabel("Nome do alimento").fill("Registro preservado");
  const calories = page.getByLabel(/^Calorias/);
  await calories.fill("");
  await expect(calories).toHaveValue("");
  await calories.fill("150");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("asimov-fit:v1:alex@exemplo.com")!)
            .mealDrafts?.new?.meal.items[0]?.calories,
      ),
    )
    .toBe(150);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    const key = "asimov-fit:v1:alex@exemplo.com";
    const count = JSON.parse(localStorage.getItem(key)!).meals.length;
    Storage.prototype.setItem = function (k, value) {
      if (k === key && JSON.parse(value).meals.length > count) {
        Storage.prototype.setItem = original;
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      original.call(this, k, value);
    };
  });
  await page.getByRole("button", { name: "Salvar refeição" }).click();
  await expect(page.getByRole("alert")).toContainText("tente novamente");
  await expect(page.getByLabel("Nome do alimento")).toHaveValue(
    "Registro preservado",
  );
  await page.getByRole("button", { name: "Salvar refeição" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Registro preservado", { exact: true }),
  ).toBeVisible();
});
