import { test, expect } from "@playwright/test";

test("manifest, standalone mode and icon dimensions in the production build", async ({
  page,
  request,
}) => {
  await page.goto("/entrar");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/icons/apple-touch-icon.png",
  );
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: "/",
    short_name: "FORTIVA",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  expect(
    manifest.icons.some(
      (icon: { purpose: string }) => icon.purpose === "maskable",
    ),
  ).toBeTruthy();
  for (const icon of [
    ...manifest.icons,
    { src: "/icons/apple-touch-icon.png", sizes: "180x180" },
  ]) {
    const png = await request.get(icon.src);
    expect(png.headers()["content-type"]).toContain("image/png");
    const body = await png.body();
    const [width, height] = icon.sizes.split("x").map(Number);
    expect(body.readUInt32BE(16)).toBe(width);
    expect(body.readUInt32BE(20)).toBe(height);
  }
});

test("offline navigation uses a public fallback and reconnect preserves the destination", async ({
  page,
  context,
}) => {
  await page.goto("/entrar");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("Sem conexão");
  await page.goto("/redefinir-senha");
  await expect(
    page.getByRole("heading", { name: "Vamos retomar quando houver conexão." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/redefinir-senha$/);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Crie uma nova senha" }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/pwa-recovery.png" });
});

test("the service worker caches only public fallback assets, never API data or auth URLs", async ({
  page,
}) => {
  await page.goto("/entrar");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.route("**/rest/v1/pwa-cache-test", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: '{"private":"test-record"}',
    }),
  );
  await page.evaluate(() =>
    fetch("/rest/v1/pwa-cache-test").then((r) => r.json()),
  );
  await page.goto("/entrar?auth_test=should-never-be-cached");
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys())
        urls.push(new URL(req.url).pathname + new URL(req.url).search);
    }
    return urls.sort();
  });
  expect(cached).toEqual(["/icons/icon-192.png", "/offline.html"]);
});
