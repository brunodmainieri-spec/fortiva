import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { blankData } from "../src/domain";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "ana@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { name: "Ana" },
  created_at: "2026-09-23T12:00:00Z",
};
const jwt =
  [
    { alg: "HS256", typ: "JWT" },
    {
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "authenticated",
    },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".") + ".testsignature";
const session = {
  access_token: jwt,
  refresh_token: "test-refresh",
  expires_in: 3600,
  token_type: "bearer",
  user,
};
async function backend(page: Page) {
  const state = {
    document: null as ReturnType<typeof blankData> | null,
    revision: 0,
    failSave: false,
    conflict: false,
    saves: 0,
    recover: 0,
    password: "",
    chatStatus: 200,
    chatCalls: 0,
    chatDates: [] as string[],
    chatHistory: [] as { question: string; answer: string }[],
    chatDelay: 0,
    trainingStatus: 200,
    photoCalls: 0,
    photoStatus: 200,
    photoEmpty: false,
  };
  await page.route("https://*.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    const respond = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "X-Supabase-Api-Version": "2024-01-01" },
        body: JSON.stringify(data),
      });
    if (path.endsWith("/assistant-chat")) {
      state.chatCalls++;
      state.chatHistory = body.history;
      state.chatDates = body.facts.dates;
      expect(JSON.stringify(body)).not.toContain(user.email);
      expect(body.facts).not.toHaveProperty("profile");
      if (state.chatDelay)
        await new Promise((resolve) => setTimeout(resolve, state.chatDelay));
      if (state.chatStatus !== 200)
        return respond(
          { message: "Não foi possível responder agora." },
          state.chatStatus,
        );
      return respond({
        paragraphs: [
          "Você ainda não tem registros suficientes neste período. Posso ajudar a entender como acompanhar sua rotina.",
        ],
      });
    }
    if (path.endsWith("/generate-training-plan")) {
      expect(Object.keys(body.profile).sort()).toEqual([
        "age",
        "experience",
        "frequency",
        "goal",
        "minutes",
        "months",
      ]);
      expect(route.request().headers().authorization).toContain("Bearer ");
      if (state.trainingStatus !== 200)
        return respond(
          { message: "Não foi possível gerar o plano agora." },
          state.trainingStatus,
        );
      return respond({
        name: "Plano criado pela IA",
        description: "Treino em academia convencional.",
        days: Array.from({ length: body.profile.frequency }, (_, i) => ({
          name: "Dia " + (i + 1),
          exercises: [
            "Mesa flexora",
            "Crucifixo inclinado",
            "Remada unilateral",
            "Elevação lateral",
            "Rosca martelo",
            "Panturrilha sentada",
          ].map((name) => ({ name, sets: 2, reps: 12, rest: 60 })),
        })),
      });
    }
    if (path.endsWith("/analyze-meal-photo")) {
      state.photoCalls++;
      expect(body.photo).toMatch(/^data:image\/jpeg;base64,/);
      expect(route.request().headers().authorization).toContain("Bearer ");
      if (state.photoStatus !== 200)
        return respond(
          {
            message:
              "O serviço de IA está indisponível. Tente novamente mais tarde.",
          },
          state.photoStatus,
        );
      return respond({
        items: state.photoEmpty
          ? []
          : [
              {
                name: "Arroz cozido",
                portion: 100,
                unit: "g",
                calories: 130,
                protein: 2.7,
                carbs: 28,
                fat: 0.3,
              },
            ],
        note: state.photoEmpty
          ? "Não identifiquei alimentos nesta foto."
          : "Porção estimada. Confira a quantidade antes de salvar.",
      });
    }
    if (path.endsWith("/token")) {
      if (body.password === "wrong123")
        return respond(
          { code: "invalid_credentials", msg: "Invalid login credentials" },
          400,
        );
      return respond(session);
    }
    if (path.endsWith("/signup")) return respond({ user, session: null });
    if (path.endsWith("/user")) {
      if (route.request().method() === "PUT") state.password = body.password;
      return respond(user);
    }
    if (path.endsWith("/logout")) return route.fulfill({ status: 204 });
    if (path.endsWith("/recover")) {
      state.recover++;
      return respond({});
    }
    if (path.endsWith("/fortiva_load"))
      return respond(
        state.document
          ? { document: state.document, revision: state.revision }
          : null,
      );
    if (path.endsWith("/fortiva_save")) {
      if (state.failSave)
        return respond(
          { code: "XX000", message: "Falha de rede de teste" },
          500,
        );
      if (state.conflict || body.expected_revision !== state.revision)
        return respond({ code: "40001", message: "Concurrent update" }, 409);
      state.document = body.document;
      state.revision++;
      state.saves++;
      return respond(state.revision);
    }
    throw new Error("Unexpected network request: " + path);
  });
  return state;
}
async function login(page: Page, password = "correct123") {
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
}

test("real auth UI: confirmation, wrong password, recovery and no demo access", async ({
  page,
}) => {
  const state = await backend(page);
  await page.goto("/entrar");
  await expect(
    page.getByRole("button", { name: /Explorar demonstração/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Seu nome").fill("Ana");
  await page.getByLabel("E-mail", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("correct123");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(
    page.getByText("Confira seu e-mail para confirmar o cadastro.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(state.saves).toBe(0);
  await login(page, "wrong123");
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(
    page.getByText("Se existir uma conta", { exact: false }),
  ).toBeVisible();
  expect(state.recover).toBe(1);
});

test("onboarding saves remotely, survives reload and logout, and fails safely", async ({
  page,
}) => {
  const state = await backend(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Vamos nos conhecer." }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Idade/)).toHaveValue("");
  await page.getByLabel(/^Idade/).fill("30");
  await page.getByLabel(/^Altura/).fill("165");
  await page.getByLabel(/^Peso atual/).fill("70");
  state.failSave = true;
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByText("Falha de rede de teste")).toBeVisible();
  await expect(page.getByLabel(/^Altura/)).toHaveValue("165");
  expect(state.document).toBeNull();
  state.failSave = false;
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "O que te move?" }),
  ).toBeVisible();
  expect(state.document?.meals).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "O que te move?" }),
  ).toBeVisible();
  await page.getByLabel(/^Peso desejado/).fill("65");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Sua rotina de treino").selectOption("none");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Começar minha jornada" }).click();
  await expect(page.getByRole("heading", { name: /Olá, Ana/ })).toBeVisible();
  expect(state.document?.profile.onboarded).toBe(true);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("asimov-fit:v1:")),
    ),
  ).toEqual([]);
  await page.goto("/perfil");
  await expect(page.getByRole("heading", { name: "Seu perfil" })).toBeVisible();
  await page.getByRole("button", { name: "Preferências", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "FORTIVA no seu celular" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const install = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(install, {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(install);
  });
  await page
    .getByRole("button", { name: "Instalar aplicativo", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Instalar aplicativo", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(
    page.getByText("O aplicativo já está instalado.", { exact: false }),
  ).toBeVisible();
  state.conflict = true;
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(
    page.getByText("Seus dados mudaram em outra aba", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Entrar na minha conta" }),
  ).toBeVisible();
  expect(state.document?.profile.onboarded).toBe(true);
  expect(errors).toEqual([]);
});

test("password recovery link leads to a new password and sign-out", async ({
  page,
}) => {
  const state = await backend(page);
  await page.goto(
    "/redefinir-senha#access_token=" +
      jwt +
      "&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=recovery",
  );
  await expect(
    page.getByRole("heading", { name: "Crie uma nova senha" }),
  ).toBeVisible();
  await page.getByLabel("Nova senha", { exact: true }).fill("new-password123");
  await page.getByLabel("Confirme a nova senha").fill("new-password123");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar na minha conta" }),
  ).toBeVisible();
  expect(state.password).toBe("new-password123");
});

test("photo analysis retries failures, allows review and saves only after confirmation", async ({
  page,
}) => {
  const state = await backend(page);
  state.document = blankData(user.email, "Ana");
  state.document.profile = {
    ...state.document.profile,
    onboarded: true,
    age: 30,
    weight: 70,
    height: 165,
  };
  await login(page);
  await page
    .getByRole("button", { name: "Registrar refeição por foto", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "refeicao.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/RkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(
    dialog.getByRole("button", { name: "Analisar foto", exact: true }),
  ).toBeEnabled();
  state.photoStatus = 502;
  await dialog
    .getByRole("button", { name: "Analisar foto", exact: true })
    .click();
  await expect(
    dialog.getByText("O serviço de IA está indisponível.", { exact: false }),
  ).toBeVisible();
  expect(state.document.meals).toHaveLength(0);
  await expect(
    dialog.getByAltText("Foto da refeição selecionada"),
  ).toBeVisible();
  state.photoStatus = 200;
  state.photoEmpty = true;
  await dialog
    .getByRole("button", { name: "Analisar foto", exact: true })
    .click();
  await expect(
    dialog.getByText("Não identifiquei alimentos nesta foto."),
  ).toBeVisible();
  expect(state.document.meals).toHaveLength(0);
  state.photoEmpty = false;
  await dialog
    .getByRole("button", { name: "Analisar foto", exact: true })
    .click();
  await expect(dialog.getByLabel("Nome do alimento")).toHaveValue(
    "Arroz cozido",
  );
  await expect(
    dialog.getByRole("button", { name: "Itens adicionados" }),
  ).toBeDisabled();
  await expect(
    dialog.getByText("Porção estimada. Confira a quantidade antes de salvar."),
  ).toBeVisible();
  expect(state.document.meals).toHaveLength(0);
  await dialog.getByLabel("Porção", { exact: true }).fill("150");
  await dialog.getByLabel("Nome do alimento").fill("Arroz revisado");
  await dialog
    .getByRole("button", { name: "Salvar refeição", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.document.meals).toHaveLength(1);
  expect(state.document.meals[0].items[0]).toMatchObject({
    name: "Arroz revisado",
    portion: 150,
    calories: 195,
  });
  expect(state.photoCalls).toBe(3);
  await page.reload();
  await expect(
    page.getByText("Arroz revisado", { exact: false }).first(),
  ).toBeVisible();
});

test("AI chooses free exercises; errors retry and proposal requires saving", async ({
  page,
}) => {
  const state = await backend(page);
  state.document = blankData(user.email, "Ana");
  Object.assign(state.document.profile, {
    onboarded: true,
    age: 30,
    height: 165,
    weight: 70,
    frequency: 2,
    minutes: 40,
    months: 2,
    experience: "beginner",
  });
  await login(page);
  await expect(
    page.getByRole("button", {
      name: "Registrar refeição por foto",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/treinos");
  await page.getByRole("button", { name: "Gerar com IA", exact: true }).click();
  const dialog = page.getByRole("dialog");
  state.trainingStatus = 502;
  await dialog
    .getByRole("button", { name: "Gerar proposta de treino" })
    .click();
  await expect(
    dialog.getByText("Não foi possível gerar o plano agora."),
  ).toBeVisible();
  expect(state.document.plans).toHaveLength(0);
  state.trainingStatus = 200;
  await dialog
    .getByRole("button", { name: "Gerar proposta de treino" })
    .click();
  await expect(dialog.getByLabel("Nome do plano")).toHaveValue(
    "Plano criado pela IA",
  );
  await expect(dialog.getByLabel("Nome do exercício").first()).toHaveValue(
    "Mesa flexora",
  );
  expect(state.document.plans).toHaveLength(0);
  await expect(dialog.getByLabel("Nome do exercício")).toHaveCount(12);
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await dialog
    .getByLabel("Nome do exercício")
    .first()
    .fill("Mesa flexora revisada");
  await dialog.getByLabel("Nome do plano").fill("Meu plano revisado");
  await dialog
    .getByRole("button", { name: "Salvar plano", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.document.plans).toHaveLength(1);
  const plan = state.document.plans[0];
  expect(plan.active).toBe(false);
  expect(plan.days[0].exercises).toHaveLength(6);
  expect(plan.days[0].exercises[0]).toMatchObject({
    name: "Mesa flexora revisada",
    exerciseId: "custom-mesa flexora revisada",
    weight: 0,
  });
  await page.reload();
  await expect(
    page.getByText("Meu plano revisado", { exact: true }),
  ).toBeVisible();
});

test("AI chat stays clean, retries, keeps context and cancels closed requests", async ({
  page,
}) => {
  const state = await backend(page);
  state.document = blankData(user.email, "Ana");
  Object.assign(state.document.profile, {
    onboarded: true,
    age: 30,
    height: 165,
    weight: 70,
  });
  await login(page);
  await page.getByRole("button", { name: "Abrir assistente" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Como posso ajudar?")).toBeVisible();
  expect(state.chatCalls).toBe(0);
  await expect(dialog.locator(".assistant-context")).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(dialog.locator(".assistant-suggestions button")).toHaveCount(3);
  await page.screenshot({ path: "test-results/chat-desktop.png" });
  await dialog.locator(".assistant-context summary").click();
  await dialog.getByLabel("Data inicial").fill("31/02/2026");
  await dialog.getByRole("button", { name: "Aplicar período" }).click();
  expect(
    await dialog
      .getByLabel("Data inicial")
      .evaluate((el: HTMLInputElement) => el.validity.valid),
  ).toBe(false);
  await dialog.getByLabel("Data inicial").fill("01/01/2020");
  await dialog.getByLabel("Data final").fill("01/03/2020");
  await dialog.getByRole("button", { name: "Aplicar período" }).click();
  await expect(
    dialog.getByText("Escolha um período de até 31 dias."),
  ).toBeVisible();
  await dialog.getByLabel("Data final").fill("05/09/2026");
  await dialog.getByLabel("Data inicial").fill("01/09/2026");
  await dialog.getByRole("button", { name: "Aplicar período" }).click();
  await expect(dialog.locator(".assistant-context summary")).toContainText(
    "5 dias",
  );
  await dialog.locator(".assistant-context summary").click();
  state.chatStatus = 502;
  await dialog.getByLabel("Sua pergunta").fill("Como estão meus registros?");
  await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    dialog.getByText("Não foi possível responder agora."),
  ).toBeVisible();
  state.chatStatus = 200;
  await dialog.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(dialog.locator(".assistant-answer")).toHaveCount(1);
  await expect(dialog.locator(".assistant-suggestions")).toHaveCount(0);
  await dialog.getByLabel("Sua pergunta").fill("Explique melhor");
  await dialog.getByLabel("Sua pergunta").press("Enter");
  await expect(dialog.locator(".assistant-answer")).toHaveCount(2);
  expect(state.chatHistory).toHaveLength(1);
  expect(state.chatDates).toEqual([
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
  ]);
  expect(state.saves).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/chat-mobile.png" });
  await dialog.locator(".assistant-context summary").click();
  await expect(dialog.getByLabel("Data inicial")).toHaveValue("01/09/2026");
  await page.screenshot({ path: "test-results/chat-context-mobile.png" });
  await dialog.locator(".assistant-context summary").click();
  const fits = await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(fits).toBe(true);
  await dialog.getByRole("button", { name: "Nova conversa" }).click();
  await expect(dialog.getByText("Como posso ajudar?")).toBeVisible();
  state.chatDelay = 1200;
  await dialog.getByLabel("Sua pergunta").fill("Mais uma pergunta");
  await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Interromper" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Abrir assistente" }).click();
  await expect(
    dialog.getByText("Resposta interrompida. Você pode tentar novamente."),
  ).toBeVisible();
  await expect(dialog.locator(".assistant-answer")).toHaveCount(0);
});
