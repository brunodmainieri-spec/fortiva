import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
// Rasterize the existing vector favicon; no generated branding or new artwork.
const source = await readFile("public/favicon.svg", "utf8");
const browser = await chromium.launch({ headless: true });
try {
  await mkdir("public/icons", { recursive: true });
  for (const [name, size, maskable] of [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["apple-touch-icon.png", 180, false],
    ["icon-maskable-512.png", 512, true],
  ]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    // A 64% central square keeps every mark inside the maskable safe circle.
    const svg = maskable
      ? source
          .replace('rx="18"', 'rx="0"')
          .replace(
            "<path ",
            '<path transform="translate(11.52 11.52) scale(.64)" ',
          )
      : source;
    await page.setContent(
      `<style>html,body{margin:0;background:#f4f0e8;width:100%;height:100%;}svg{display:block;width:100%;height:100%;}</style>${svg}`,
    );
    await page.screenshot({ path: "public/icons/" + name });
    await page.close();
  }
} finally {
  await browser.close();
}
