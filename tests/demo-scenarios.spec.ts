import { test, expect } from "@playwright/test";

test("cenários exigem confirmação e preservam outras contas locais", async ({
  page,
}) => {
  await page.goto("/entrar");
  await page.evaluate(() =>
    localStorage.setItem("asimov-fit:v1:pessoal@teste.local", "preservado"),
  );
  await page
    .getByRole("button", { name: "Escolher cenário de demonstração" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cenários de demonstração" });
  await expect(
    dialog.getByRole("button", { name: "Aplicar cenário" }),
  ).toBeDisabled();
  await dialog
    .getByRole("combobox", { name: "Cenário", exact: true })
    .selectOption("incomplete");
  await dialog
    .getByLabel("Confirmo substituir apenas os dados da demonstração.")
    .check();
  await dialog.getByRole("button", { name: "Aplicar cenário" }).click();
  await expect(page).toHaveURL(/evolucao\?tab=diet&period=week/);
  const saved = await page.evaluate(() => ({
    data: JSON.parse(localStorage.getItem("asimov-fit:v1:alex@exemplo.com")!),
    other: localStorage.getItem("asimov-fit:v1:pessoal@teste.local"),
  }));
  expect(saved.other).toBe("preservado");
  const anchor = new URL(page.url()).searchParams.get("date")!;
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${anchor}T12:00:00`);
    date.setDate(date.getDate() + index);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  });
  expect(
    dates.filter((date) => saved.data.confirmedFoodDays.includes(date)),
  ).toHaveLength(2);
  expect(
    dates.filter((date) =>
      saved.data.meals.some((meal: { date: string }) => meal.date === date),
    ),
  ).toHaveLength(4);
  await page.evaluate(() => localStorage.removeItem("asimov-fit:v1:session"));
  await page.goto("/entrar");
  await page
    .getByRole("button", { name: "Escolher cenário de demonstração" })
    .click();
  await page
    .getByRole("combobox", { name: "Cenário", exact: true })
    .selectOption("new");
  await page
    .getByLabel("Confirmo substituir apenas os dados da demonstração.")
    .check();
  await page.getByRole("button", { name: "Aplicar cenário" }).click();
  await expect(page).toHaveURL(/onboarding/);
  await expect(page.getByLabel(/^Idade/)).toHaveValue("");
  const fresh = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("asimov-fit:v1:alex@exemplo.com")!),
  );
  expect(fresh.profile.onboarded).toBe(false);
  expect(fresh.meals).toHaveLength(0);
  expect(fresh.sessions).toHaveLength(0);
});
