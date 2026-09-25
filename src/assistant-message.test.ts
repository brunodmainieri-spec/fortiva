import { createElement } from "react";
import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantMessage, messageBlocks } from "./assistant-message";
it("groups bullets, ordered steps, and paragraphs with spacing", () => {
  expect(
    messageBlocks([
      "Resumo\ncurto\n\n- Primeiro\n• Segundo",
      "* Terceiro\n\nPróximos passos\n1. Começar\n2. Conferir",
    ]),
  ).toEqual([
    { type: "paragraph", text: "Resumo\ncurto" },
    { type: "ul", items: ["Primeiro", "Segundo", "Terceiro"] },
    { type: "paragraph", text: "Próximos passos" },
    { type: "ol", start: 1, items: ["Começar", "Conferir"] },
  ]);
});
it("renders semantic lists and bold without interpreting unsafe HTML", () => {
  const html = renderToStaticMarkup(
    createElement(AssistantMessage, {
      paragraphs: [
        "- **Proteína:** confira a meta.\n- <script>alert(1)</script>",
        "3. Próximo passo",
      ],
    }),
  );
  expect(html).toContain("<ul>");
  expect(html).toContain("<strong>Proteína:</strong>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain('<ol start="3">');
});
