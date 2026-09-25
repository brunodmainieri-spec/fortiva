import { test, expect } from "@playwright/test";
const key = "asimov-fit:v1:alex@exemplo.com";
test("macros calculam calorias e preservam o total salvo", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.locator("main h1")).toContainText("Alex");
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Adicionar alimento manualmente" })
    .click();
  await dialog.getByLabel("Nome do alimento").fill("Refeição com macros");
  await dialog.getByLabel(/^Proteínas/).fill("20");
  await expect(dialog.getByLabel(/^Calorias/)).toHaveValue("80");
  await dialog.getByLabel(/^Carboidratos/).fill("30.5");
  await dialog.getByLabel(/^Gorduras/).fill("10");
  await expect(dialog.getByLabel(/^Calorias/)).toHaveValue("292");
  await expect(dialog.locator(".meal-total")).toContainText("292");
  await dialog.getByLabel(/^Gorduras/).fill("");
  await expect(dialog.getByLabel(/^Calorias/)).toHaveValue("202");
  await dialog.getByLabel(/^Gorduras/).fill("5");
  await dialog.getByLabel("Porção", { exact: true }).fill("200");
  await expect(dialog.getByLabel(/^Calorias/)).toHaveValue("494");
  await dialog
    .getByRole("button", { name: "Salvar refeição", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const saved = await page.evaluate((k) => {
    const data = JSON.parse(localStorage.getItem(k)!);
    return data.meals
      .flatMap(
        (meal: { items: { name: string; calories: number }[] }) => meal.items,
      )
      .find((item: { name: string }) => item.name === "Refeição com macros");
  }, key);
  expect(saved).toMatchObject({
    calories: 494,
    protein: 40,
    carbs: 61,
    fat: 10,
  });
});

test("rascunho, biblioteca, confirmação e desfazer preservam o diário", async ({
  page,
}) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.locator("main h1")).toContainText("Alex");
  const read = () =>
    page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
  const count = (await read()).meals.length;
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Adicionar alimento manualmente" })
    .click();
  await dialog.getByLabel("Nome do alimento").fill("Lanche favorito UX");
  await dialog.getByLabel(/^Calorias/).fill("250");
  await dialog.getByLabel("Salvar também em Minhas refeições").check();
  await dialog.getByLabel("Nome da refeição salva").fill("Meu lanche UX");
  await dialog
    .getByRole("button", { name: "Fechar e continuar depois" })
    .click();
  await expect(dialog).not.toBeVisible();
  expect((await read()).meals).toHaveLength(count);
  await page.reload();
  await page.getByRole("button", { name: "Continuar registro" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Nome do alimento")).toHaveValue(
    "Lanche favorito UX",
  );
  await expect(dialog.getByLabel("Nome da refeição salva")).toHaveValue(
    "Meu lanche UX",
  );
  await dialog
    .getByRole("button", { name: "Salvar refeição", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect((await read()).meals).toHaveLength(count + 1);
  expect((await read()).mealDrafts).toEqual({});
  await page
    .getByRole("button", { name: "Concluí os registros do dia" })
    .click();
  await expect(page.getByText("Dia confirmado", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Favoritar Lanche favorito UX", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Favoritos", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Adicionar Lanche favorito UX" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Minhas refeições", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Usar refeição", exact: true })
    .click();
  await expect(dialog.getByLabel("Nome do alimento")).toHaveValue(
    "Lanche favorito UX",
  );
  await dialog.getByLabel("Nome do alimento").fill("Lanche repetido UX");
  await dialog
    .getByRole("button", { name: "Salvar refeição", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Registro em andamento", { exact: true }),
  ).toBeVisible();
  const meal = page
    .locator(".meal-card")
    .filter({ hasText: "Lanche repetido UX" });
  await meal.getByRole("button", { name: /Excluir/ }).click();
  await expect(meal).not.toBeVisible();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(meal).toBeVisible();
  await page.reload();
  expect((await read()).favoriteFoods).toHaveLength(1);
  expect((await read()).meals).toHaveLength(count + 2);
});

test("foto preserva edições durante processamento e ignora resultado removido", async ({
  page,
}) => {
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/RkAAAAASUVORK5CYII=",
    "base64",
  );
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.locator("main h1")).toContainText("Alex");
  await page.setViewportSize({ width: 320, height: 740 });
  await page
    .getByRole("button", { name: "Registrar refeição por foto", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Escolher foto" }),
  ).toBeVisible();
  await dialog
    .getByLabel("Selecionar foto da refeição")
    .setInputFiles({ name: "prato.png", mimeType: "image/png", buffer: pixel });
  await dialog
    .getByRole("button", { name: "Adicionar alimento manualmente" })
    .click();
  await dialog.getByLabel("Nome do alimento").fill("Antes");
  await dialog
    .getByRole("button", { name: "Analisar foto", exact: true })
    .click();
  await dialog
    .getByLabel("Nome do alimento")
    .first()
    .fill("Editado durante análise");
  await expect(dialog.getByLabel("Nome do alimento")).toHaveCount(4);
  await expect(dialog.getByLabel("Nome do alimento").first()).toHaveValue(
    "Editado durante análise",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.screenshot({ path: "artifacts/food-editor-320.png" });
  await dialog
    .getByRole("button", { name: "Remover foto", exact: true })
    .click();
  await dialog
    .getByLabel("Selecionar foto da refeição")
    .setInputFiles({ name: "prato.png", mimeType: "image/png", buffer: pixel });
  await dialog
    .getByRole("button", { name: "Analisar foto", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Remover foto", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Escolher foto", exact: true }),
  ).toBeEnabled();
  await expect(dialog.getByLabel("Nome do alimento")).toHaveCount(4);
  const drafts = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).mealDrafts,
    key,
  );
  expect(drafts.new.meal.items.every((i: { photo?: string }) => !i.photo)).toBe(
    true,
  );
});
