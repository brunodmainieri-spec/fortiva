import { test, expect } from "@playwright/test";

test("onboarding permite metas de medidas opcionais e rotina sem treino", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Seu nome").fill("Ana Inicio");
  await page.getByLabel("E-mail", { exact: true }).fill("ana.ux@teste.local");
  await page.getByLabel("Senha", { exact: true }).fill("teste123");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await page.getByLabel(/^Idade/).fill("30");
  await page.getByLabel(/^Altura/).fill("165");
  await page.getByLabel(/^Peso atual/).fill("70");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel(/^Peso desejado/).fill("65");
  await page.getByLabel(/^Meta de cintura/).fill("75");
  await page
    .getByRole("button", { name: "Definir depois a meta de cintura" })
    .click();
  await expect(page.getByLabel(/^Meta de cintura/)).toHaveValue("");
  await expect(page.getByLabel(/^Meta de braço/)).toHaveValue("");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Sua rotina de treino").selectOption("training");
  await page.getByLabel(/^Dias por semana/).fill("4");
  await page.getByLabel("Sua rotina de treino").selectOption("none");
  await expect(page.getByLabel(/^Dias por semana/)).toHaveCount(0);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByText(
      "Você pode começar pela alimentação e definir sua rotina de treino depois.",
      { exact: false },
    ),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Começar minha jornada" }).click();
  await expect(page).toHaveURL(/\/$/);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("asimov-fit:v1:ana.ux@teste.local")!),
  );
  expect(saved.profile).toMatchObject({
    onboarded: true,
    targetWaist: 0,
    targetArm: 0,
    frequency: 0,
    months: 0,
    minutes: 0,
  });
  expect(saved.goals[0].frequency).toBe(0);
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Metas e rotina" }).click();
  await expect(page.getByLabel("Sua rotina de treino")).toHaveValue("none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
