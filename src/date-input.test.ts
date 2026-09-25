import { it, expect } from "vitest";
import { displayDate, parseDate } from "./date-input";
it("uses Brazilian dates and retains ISO storage without timezone shifts", () => {
  expect(displayDate("2026-09-23")).toBe("23/09/2026");
  expect(parseDate("23/09/2026")).toBe("2026-09-23");
  expect(parseDate("29/02/2024")).toBe("2024-02-29");
  for (const value of [
    "29/02/2025",
    "31/04/2026",
    "00/01/2026",
    "01/13/2026",
    "01/01/0000",
    "2026-09-23",
    "1/1/2026",
    "",
  ])
    expect(parseDate(value)).toBeNull();
});
