type Block =
  | { type: "paragraph"; text: string }
  | { type: "ul" | "ol"; items: string[]; start?: number };
export function messageBlocks(paragraphs: string[]): Block[] {
  const blocks: Block[] = [];
  let lines: string[] = [];
  const flush = () => {
    if (lines.length) {
      blocks.push({ type: "paragraph", text: lines.join("\n") });
      lines = [];
    }
  };
  for (const line of paragraphs
    .join("\n\n")
    .replace(/\r\n?/g, "\n")
    .split("\n")) {
    if (!line.trim()) {
      flush();
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (bullet || ordered) {
      flush();
      const type = bullet ? "ul" : "ol";
      const text = bullet ? bullet[1] : ordered![2];
      const last = blocks.at(-1);
      if (last?.type === type) last.items.push(text);
      else
        blocks.push({
          type,
          items: [text],
          ...(ordered ? { start: Number(ordered[1]) } : {}),
        });
    } else lines.push(line);
  }
  flush();
  return blocks;
}
function inline(text: string) {
  return text
    .split(/(\*\*[^*\n]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}
export function AssistantMessage({ paragraphs }: { paragraphs: string[] }) {
  return (
    <>
      {messageBlocks(paragraphs).map((block, i) =>
        block.type === "paragraph" ? (
          <p key={i}>{inline(block.text)}</p>
        ) : block.type === "ol" ? (
          <ol key={i} start={block.start}>
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ol>
        ) : (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}
