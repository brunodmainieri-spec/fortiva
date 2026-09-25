import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "node:fs";
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/RkAAAAASUVORK5CYII=",
  "base64",
);
async function demo(page: Page) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(page.getByRole("heading", { name: /Olá, Alex/ })).toBeVisible();
}
async function stored(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("asimov-fit:v1:alex@exemplo.com")!),
  );
}

test("demonstração, navegação responsiva e telas sem erros", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/entrar");
  fs.mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/login-desktop.png",
    fullPage: true,
  });
  await demo(page);
  await page.screenshot({
    path: "artifacts/diario-desktop.png",
    fullPage: true,
  });
  for (const route of [
    "/treinos",
    "/evolucao",
    "/evolucao?tab=training",
    "/evolucao?tab=body",
    "/perfil",
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of [
    "/",
    "/treinos",
    "/evolucao",
    "/evolucao?tab=body",
    "/perfil",
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBeTruthy();
    await page.screenshot({
      path:
        "artifacts/" +
        (route === "/"
          ? "diario"
          : route.includes("body")
            ? "medidas"
            : route.slice(1)) +
        "-mobile.png",
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
test("cadastro e onboarding criam um perfil vazio com metas funcionais", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Seu nome").fill("Marina Teste");
  await page.getByLabel("E-mail", { exact: true }).fill("marina@teste.local");
  await page.getByLabel("Senha", { exact: true }).fill("teste123");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Vamos nos conhecer." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByLabel(/^Idade/)).toHaveValue("");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Vamos nos conhecer." }),
  ).toBeVisible();
  await page.getByLabel(/^Idade/).fill("30");
  await page.getByLabel(/^Altura/).fill("165");
  await page.getByLabel(/^Peso atual/).fill("70");
  await page.getByLabel("Coeficiente para o cálculo").selectOption("female");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "O que te move?" }),
  ).toBeVisible();
  await page.getByLabel("Seu objetivo").selectOption("cutting");
  await page.getByLabel(/^Peso desejado/).fill("65");
  await page.getByLabel(/^Meta de cintura/).fill("75");
  await page.getByLabel(/^Meta de braço/).fill("30");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Sua rotina de treino").selectOption("training");
  await page.getByLabel("Experiência").selectOption("beginner");
  await page.getByLabel(/^Tempo de prática/).fill("2");
  await page.getByLabel(/^Dias por semana/).fill("4");
  await page.getByLabel(/^Tempo por treino/).fill("40");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByLabel(/^Calorias/)).toHaveValue("1981");
  await page.getByLabel(/^Calorias/).fill("2000");
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByLabel(/^Calorias/)).toHaveValue("2000");
  await page.getByRole("button", { name: "Sair e continuar depois" }).click();
  await page.getByLabel("E-mail", { exact: true }).fill("marina@teste.local");
  await page.getByLabel("Senha", { exact: true }).fill("teste123");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Um plano para começar." }),
  ).toBeVisible();
  await page.goto("/treinos");
  await expect(page).toHaveURL(/onboarding/);
  await expect(page.getByLabel(/^Calorias/)).toHaveValue("2000");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Começar minha jornada" }).click();
  await expect(
    page.getByRole("heading", { name: /Olá, Marina/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("asimov-fit:v1:marina@teste.local")!)
          .meals,
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "teste123",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Olá, Marina/ }),
  ).toBeVisible();
});
test("refeição manual recalcula porção, persiste, edita e exclui", async ({
  page,
}) => {
  await demo(page);
  const before = await stored(page);
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Manualmente", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Adicionar alimento manualmente" })
    .click();
  await dialog.getByLabel("Nome do alimento").fill("Aveia de teste");
  await dialog.getByLabel(/^Calorias/).fill("100");
  await dialog.getByLabel(/^Proteínas/).fill("5");
  await dialog.getByLabel(/^Carboidratos/).fill("15");
  await dialog.getByLabel(/^Gorduras/).fill("2");
  await dialog.getByLabel("Porção", { exact: true }).fill("200");
  await expect(dialog.getByLabel(/^Calorias/)).toHaveValue("200");
  await dialog.getByRole("button", { name: "Salvar refeição" }).click();
  await expect(dialog).not.toBeVisible();
  expect((await stored(page)).meals.length).toBe(before.meals.length + 1);
  await page.reload();
  await expect(page.getByText("Aveia de teste", { exact: true })).toBeVisible();
  const meal = page.locator(".meal-card").filter({ hasText: "Aveia de teste" });
  await meal.getByRole("button", { name: "Editar Almoço" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Nome do alimento")
    .fill("Aveia revisada");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.getByText("Aveia revisada", { exact: true })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .locator(".meal-card")
    .filter({ hasText: "Aveia revisada" })
    .getByRole("button", { name: "Excluir Almoço" })
    .click();
  await expect(
    page.getByText("Aveia revisada", { exact: true }),
  ).not.toBeVisible();
});
test("foto passa por erro recuperável, revisão e confirmação explícita", async ({
  page,
}) => {
  await demo(page);
  const count = (await stored(page)).meals.length;
  await page.goto("/?fail=analysis");
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  await page.getByRole("button", { name: "Por foto", exact: true }).click();
  await page
    .getByLabel("Selecionar foto da refeição")
    .setInputFiles({ name: "prato.png", mimeType: "image/png", buffer: pixel });
  await expect(
    page.getByRole("button", { name: "Analisar foto" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Analisar foto" }).click();
  await expect(page.getByRole("alert")).toContainText("tente novamente");
  await page.getByRole("button", { name: "Analisar foto" }).click();
  await expect(
    page.getByRole("heading", { name: "Revise os alimentos" }),
  ).toBeVisible();
  expect((await stored(page)).meals.length).toBe(count);
  await page.getByLabel("Nome do alimento").first().fill("Frango revisado");
  await page.getByRole("button", { name: "Salvar refeição" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const saved = await stored(page);
  expect(saved.meals.length).toBe(count + 1);
  expect(saved.meals.at(-1).items).toHaveLength(3);
  expect(saved.meals.at(-1).items[0].photo).toMatch(/^data:image\/jpeg/);
});
test("plano manual, geração simulada e histórico de prescrição", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/treinos");
  await page.getByRole("button", { name: "Criar plano", exact: true }).click();
  await page.getByLabel("Nome do plano").fill("Plano teste");
  await page.getByLabel("Descrição", { exact: true }).fill("Minha rotina");
  await page.getByRole("button", { name: "Salvar plano" }).click();
  await expect(
    page.getByRole("heading", { name: "Plano teste", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar Plano teste", exact: true })
    .click();
  await page.getByLabel("Séries", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Salvar plano" }).click();
  const plan = (await stored(page)).plans.find(
    (p: any) => p.name === "Plano teste",
  );
  expect(plan.days[0].exercises[0].sets).toBe(4);
  expect(plan.revisions[0].days[0].exercises[0].sets).toBe(3);
  await page.getByRole("button", { name: "Gerar com IA" }).click();
  await page.getByLabel(/^Dias por semana/).fill("2");
  await page.getByRole("button", { name: "Gerar proposta de treino" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu novo plano" }),
  ).toBeVisible();
  expect((await stored(page)).plans).toHaveLength(3);
  await page.getByRole("button", { name: "Salvar plano" }).click();
  expect((await stored(page)).plans).toHaveLength(4);
});
test("treino salva séries, retoma depois de recarregar e conclui", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/treinos");
  await page
    .getByRole("button", { name: "Iniciar treino", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Carga série 1 Supino reto", { exact: true })
    .fill("42");
  await page
    .getByLabel("Repetições série 1 Supino reto", { exact: true })
    .fill("8");
  await page
    .getByRole("button", { name: "Concluir série 1 Supino reto", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Retomar treino", exact: true })
    .click();
  await expect(
    page.getByLabel("Carga série 1 Supino reto", { exact: true }),
  ).toHaveValue("42");
  await expect(
    page.getByRole("button", {
      name: "Concluir série 1 Supino reto",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Concluir treino", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Treino registrado!" }),
  ).toBeVisible();
  const session = (await stored(page)).sessions.at(-1);
  expect(session.finishedAt).toBeTruthy();
  expect(
    session.exercises[0].sets[0].weight * session.exercises[0].sets[0].reps,
  ).toBe(336);
});
test("registro retroativo só entra no histórico ao salvar", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/treinos?tab=history");
  const count = (await stored(page)).sessions.length;
  await page.getByRole("button", { name: "Registrar treino anterior" }).click();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  expect((await stored(page)).sessions).toHaveLength(count);
  await page.getByRole("button", { name: "Registrar treino anterior" }).click();
  await page
    .getByRole("button", { name: "Salvar treino", exact: true })
    .click();
  expect((await stored(page)).sessions).toHaveLength(count + 1);
});
test("medição com foto, edição, unidade e exclusão", async ({ page }) => {
  await demo(page);
  await page.goto("/evolucao?tab=body");
  await page.getByRole("button", { name: "Registrar medidas" }).click();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const date = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  await page
    .getByLabel("Data da medição")
    .fill(date.split("-").reverse().join("/"));
  await page.getByLabel(/^Peso/).fill("77.8");
  await page.getByLabel(/^Cintura/).fill("83");
  await page.getByLabel(/^Braço/).fill("35");
  await page.getByLabel("Foto do progresso").setInputFiles({
    name: "progresso.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await expect(
    page.getByRole("button", { name: "Remover foto do progresso" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar medição" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    (await stored(page)).measurements.find((m: any) => m.date === date).weight,
  ).toBe(77.8);
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Preferências", exact: true }).click();
  await page.getByLabel("Unidades de medida").selectOption("imperial");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  expect((await stored(page)).profile.units).toBe("imperial");
  expect(
    (await stored(page)).measurements.find((m: any) => m.date === date).weight,
  ).toBe(77.8);
});
test("metas atualizadas preservam passado e restauração recupera o seed", async ({
  page,
}) => {
  await demo(page);
  const initial = await stored(page);
  await page.goto("/perfil");
  await page
    .getByRole("button", { name: "Metas e rotina", exact: true })
    .click();
  await page.getByLabel(/^Calorias/).fill("2100");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  const updated = await stored(page);
  expect(updated.goals.at(-1).calories).toBe(2100);
  expect(updated.goals.slice(0, 2)).toEqual(initial.goals);
  await page.getByRole("button", { name: "Preferências", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Demonstração restaurada/);
  expect((await stored(page)).goals.at(-1).calories).toBe(2200);
});
