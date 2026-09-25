import { dayMacros, shiftDate, today } from "./domain";
import type { AppData, EnergyEntry } from "./domain";

export const ENERGY_KCAL_PER_KG = 7700;
export const ENERGY_SOURCES = {
  manual: "Manual",
  strava: "Strava",
  garmin: "Garmin",
  watch: "Relógio",
};

// One authoritative daily record avoids counting the same activity twice.
export function mergeEnergy(current: EnergyEntry[], incoming: EnergyEntry[]) {
  const entries = new Map(current.map((entry) => [entry.date, entry]));
  incoming.forEach((entry) => entries.set(entry.date, entry));
  return [...entries.values()].sort((a, b) => b.date.localeCompare(a.date));
}
export function energyStats(
  data: AppData,
  dates: string[],
  currentDate = today(),
) {
  const byDate = new Map(data.energy.map((entry) => [entry.date, entry]));
  const rows = dates
    .filter((date) => date <= currentDate)
    .map((date) => {
      const entry = byDate.get(date);
      const consumed = data.meals.some((m) => m.date === date && m.items.length)
        ? dayMacros(data, date).calories
        : null;
      const total = entry?.totalCalories ?? null;
      const basalSnapshot = [...(data.basalHistory ?? [])]
        .sort((a, b) => b.date.localeCompare(a.date))
        .find((s) => s.date <= date);
      const basal = total === null ? (basalSnapshot?.calories ?? null) : null;
      const basalBalance =
        consumed !== null && basal !== null ? consumed - basal : null;
      const balance =
        consumed !== null && total !== null ? consumed - total : null;
      return {
        date,
        entry,
        basal,
        basalBalance,
        consumed,
        total,
        balance,
        closed: date < currentDate,
        foodConfirmed: Boolean(data.confirmedFoodDays?.includes(date)),
      };
    });
  const comparable = rows.filter((r) => r.closed && r.foodConfirmed && r.balance !== null);
  const deficit = comparable.reduce(
    (sum, r) => sum + Math.max(0, -r.balance!),
    0,
  );
  const surplus = comparable.reduce(
    (sum, r) => sum + Math.max(0, r.balance!),
    0,
  );
  const totalDays = rows.filter((r) => r.total !== null);
  const measurements = [...data.measurements]
    .filter((m) => dates.includes(m.date) && m.date <= currentDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = measurements[0];
  const last = measurements.at(-1);
  return {
    rows,
    basalDays: rows.filter((r) => r.basal !== null).length,
    basalTotal: rows.reduce((sum, r) => sum + (r.basal ?? 0), 0),
    basalComparedDays: rows.filter((r) => r.closed && r.foodConfirmed && r.basalBalance !== null)
      .length,
    basalNet: rows
      .filter((r) => r.closed && r.foodConfirmed && r.basalBalance !== null)
      .reduce((sum, r) => sum + r.basalBalance!, 0),
    comparableDays: comparable.length,
    deficit,
    surplus,
    net: comparable.length ? surplus - deficit : null,
    theoreticalKg: comparable.length
      ? (surplus - deficit) / ENERGY_KCAL_PER_KG
      : null,
    total: totalDays.length
      ? totalDays.reduce((sum, r) => sum + r.total!, 0)
      : null,
    totalDays: totalDays.length,
    recordedDays: rows.filter((r) => r.entry).length,
    simulatedDays: rows.filter((r) => r.entry?.simulated).length,
    active: rows.reduce((sum, r) => sum + (r.entry?.activeCalories ?? 0), 0),
    minutes: rows.reduce((sum, r) => sum + (r.entry?.minutes ?? 0), 0),
    observed:
      first && last && first.date !== last.date
        ? { kg: last.weight - first.weight, from: first.date, to: last.date }
        : null,
  };
}
export function validateEnergy(entry: EnergyEntry) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
    shiftDate(entry.date, 0) !== entry.date ||
    entry.date > today()
  )
    throw new Error("Informe uma data válida até hoje.");
  if (
    ![entry.activeCalories, entry.minutes].every(
      (n) => Number.isFinite(n) && n >= 0,
    ) ||
    entry.minutes > 1440
  )
    throw new Error(
      "Confira as calorias e o tempo de atividade (até 1.440 minutos).",
    );
  if (
    entry.totalCalories !== null &&
    (!Number.isFinite(entry.totalCalories) ||
      entry.totalCalories < entry.activeCalories ||
      entry.totalCalories <= 0)
  )
    throw new Error(
      "O gasto total deve ser positivo e incluir as calorias de atividade.",
    );
}
