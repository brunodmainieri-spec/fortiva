import { DateInput } from "./date-input";
import { ExplainButton } from "./assistant";
import { EnergyPanel } from "./energy";
import "./evolution-ux.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  ImagePlus,
  Pencil,
  Plus,
  Ruler,
  Scale,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useApp, useData } from "./store";
import {
  calorieBalance,
  dateLabel,
  dayMacros,
  fmt,
  goalAt,
  lengthDisplay,
  lengthInternal,
  lengthUnit,
  localDate,
  periodDates,
  periodStats,
  shiftDate,
  sumMacros,
  today,
  uid,
  volume,
  weightDisplay,
  weightInternal,
  weightUnit,
} from "./domain";
import type { Measurement } from "./domain";
import { compressPhoto } from "./services";
import {
  Button,
  Empty,
  ErrorBox,
  Field,
  IconButton,
  Modal,
  NumberField,
  PageTitle,
  SaveButton,
  SectionHeading,
  Segmented,
  StatCard,
  useFormTask,
} from "./ui";

const tooltipStyle = {
  background: "var(--chart-tooltip-bg, #19334a)",
  border: "1px solid var(--chart-tooltip-border, #2b4c66)",
  borderRadius: 16,
  boxShadow: "var(--chart-tooltip-shadow, none)",
  backdropFilter: "var(--chart-tooltip-blur, none)",
  WebkitBackdropFilter: "var(--chart-tooltip-blur, none)",
  color: "#f0eee8",
  fontSize: 12,
};
const axisStyle = { fontSize: 11, fill: "#7b8c9f" };
export function EvolutionPage() {
  const data = useData();
  const { update, notify } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (
    ["diet", "training", "body", "energy"].includes(params.get("tab") ?? "")
      ? params.get("tab")
      : "diet"
  ) as "diet" | "training" | "body" | "energy";
  const period = (
    ["day", "week", "month"].includes(params.get("period") ?? "")
      ? params.get("period")
      : "month"
  ) as "day" | "week" | "month";
  const requestedAnchor = params.get("date");
  const anchor =
    requestedAnchor &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedAnchor) &&
    shiftDate(requestedAnchor, 0) === requestedAnchor &&
    requestedAnchor <= today()
      ? requestedAnchor
      : today();
  const changeFilter = (key: string, value: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      return next;
    });
  };
  const setPeriod = (value: typeof period) => changeFilter("period", value);
  const setAnchor = (value: string) => changeFilter("date", value);
  const scrollKey = `asimov-fit:evolution-scroll:${data.profile.email}:${tab}:${period}:${anchor}`;
  useEffect(() => {
    try {
      const position = sessionStorage.getItem(scrollKey);
      if (position !== null) {
        const frame = requestAnimationFrame(() => {
          window.scrollTo(0, Number(position));
          sessionStorage.removeItem(scrollKey);
        });
        return () => cancelAnimationFrame(frame);
      }
    } catch {
      /* Storage can be unavailable in private browsers. */
    }
  }, [scrollKey]);
  const openRecord = (path: string) => {
    try {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    } catch {
      /* Navigation still works. */
    }
    navigate(path);
  };
  const [editing, setEditing] = useState<Measurement | "new" | null>(null);
  const [metric, setMetric] = useState<"weight" | "waist" | "arm">("weight");
  const [exercise, setExercise] = useState("bench");
  const [photo, setPhoto] = useState<Measurement | null>(null);
  const task = useFormTask();
  const dates = periodDates(anchor, period);
  const stats = periodStats(data, dates);
  const filteredSessions = data.sessions
    .filter((s) => s.finishedAt && dates.includes(s.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const measurements = [...data.measurements].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const latest = measurements.filter((m) => m.date <= dates.at(-1)!).at(-1);
  const first = measurements[0];
  const selectedMeasurements = measurements.filter((m) =>
    dates.includes(m.date),
  );
  const setTab = (value: typeof tab) => changeFilter("tab", value);
  const shiftPeriod = (direction: number) => {
    if (period === "month") {
      const d = new Date(anchor + "T12:00:00");
      setAnchor(
        localDate(new Date(d.getFullYear(), d.getMonth() + direction, 1)),
      );
    } else
      setAnchor(shiftDate(anchor, direction * (period === "week" ? 7 : 1)));
  };
  let consumedBefore = 0;
  const chartData = (
    period === "day"
      ? data.meals
          .filter((m) => m.date === anchor && m.items.length)
          .sort((a, b) => a.time.localeCompare(b.time))
          .map((m) => ({
            label: `${m.time} · ${m.type}`,
            date: m.date,
            calories: sumMacros(m.items).calories,
            goal: goalAt(data, m.date)?.calories ?? null,
          }))
      : dates.map((date) => ({
          label: dateLabel(
            date,
            period === "week" ? { weekday: "short" } : { day: "numeric" },
          ),
          date,
          calories: data.meals.some((m) => m.date === date && m.items.length)
            ? dayMacros(data, date).calories
            : null,
          goal: goalAt(data, date)?.calories ?? null,
        }))
  ).map((row) => {
    if (row.calories === null)
      return { ...row, withinGoal: null, excess: null };
    const before = period === "day" ? consumedBefore : 0;
    const excess =
      calorieBalance(before + row.calories, row.goal).excess -
      calorieBalance(before, row.goal).excess;
    consumedBefore += row.calories;
    return { ...row, withinGoal: row.calories - excess, excess };
  });
  const exerciseOptions = Array.from(
    new Map(
      data.sessions
        .flatMap((s) => s.exercises)
        .map((e) => [e.exerciseId, e.name]),
    ).entries(),
  );
  const progression = filteredSessions.flatMap((s) => {
    const e = s.exercises.find((e) => e.exerciseId === exercise);
    const sets = e?.sets.filter((s) => s.done) ?? [];
    if (!sets.length) return [];
    const best = [...sets].sort(
      (a, b) => b.weight - a.weight || b.reps - a.reps,
    )[0];
    return [
      {
        label: dateLabel(s.date),
        weight: +weightDisplay(best.weight, data.profile.units).toFixed(1),
        reps: best.reps,
      },
    ];
  });
  const measurementValue = (m: Measurement) =>
    metric === "weight"
      ? weightDisplay(m.weight, data.profile.units)
      : lengthDisplay(m[metric], data.profile.units);
  const target =
    metric === "weight"
      ? weightDisplay(data.profile.targetWeight, data.profile.units)
      : lengthDisplay(
          metric === "waist"
            ? data.profile.targetWaist
            : data.profile.targetArm,
          data.profile.units,
        );
  const weeklyGoals = Array.from(
    new Set(dates.map((d) => periodDates(d, "week")[0])),
  ).map((start) => ({
    start,
    target: goalAt(data, start)?.frequency ?? null,
    count: data.sessions.filter(
      (s) => s.finishedAt && periodDates(start, "week").includes(s.date),
    ).length,
  }));
  const remove = (m: Measurement) => {
    void task.run(async () => {
      await update((d) => {
        const remaining = d.measurements.filter((v) => v.id !== m.id);
        const latest = [...remaining].sort((a, b) =>
          b.date.localeCompare(a.date),
        )[0];
        return {
          ...d,
          measurements: remaining,
          profile: {
            ...d.profile,
            weight: latest?.weight ?? d.profile.weight,
          },
        };
      });
      notify("Medição excluída.", async () => {
        await update((d) => {
          if (d.measurements.some((v) => v.date === m.date))
            throw new Error(
              "Já existe outra medição nesta data. Remova-a antes de restaurar este registro.",
            );
          const restored = [...d.measurements, m];
          const newest = [...restored].sort((a, b) =>
            b.date.localeCompare(a.date),
          )[0];
          return {
            ...d,
            measurements: restored,
            profile: { ...d.profile, weight: newest.weight },
          };
        });
      });
    });
  };
  return (
    <div className="evolution-page">
      <PageTitle
        title="Evolução"
        action={
          tab === "body" && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={17} />
              Registrar medidas
            </Button>
          )
        }
      />
      <div className="section-toolbar evolution-toolbar">
        <Segmented
          label="Tipo de evolução"
          value={tab}
          onChange={setTab}
          options={[
            { value: "diet", label: "Alimentação" },
            { value: "training", label: "Treinos" },
            { value: "body", label: "Corpo e medidas" },
            { value: "energy", label: "Gasto de energia" },
          ]}
        />
        <Segmented
          label="Período"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "day", label: "Dia" },
            { value: "week", label: "Semana" },
            { value: "month", label: "Mês" },
          ]}
        />
      </div>
      <div className="period-caption">
        <span>
          <CalendarDays size={16} />
          {period === "day"
            ? dateLabel(anchor, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : dateLabel(dates[0]) +
              " — " +
              dateLabel(dates.at(-1)!, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
        </span>
        <div className="button-row">
          <ExplainButton
            selection={{
              topic:
                tab === "training"
                  ? "training"
                  : tab === "body"
                    ? "weight"
                    : tab === "energy"
                      ? "energy"
                      : "summary",
              dates,
              exerciseId: tab === "training" ? exercise : undefined,
            }}
          />
          <IconButton label="Período anterior" onClick={() => shiftPeriod(-1)}>
            <ChevronLeft size={17} />
          </IconButton>
          <DateInput
            aria-label="Data de referência"
            max={today()}
            value={anchor}
            onValueChange={(value) =>
              value && value <= today() && setAnchor(value)
            }
          />
          <IconButton
            label="Próximo período"
            disabled={dates.at(-1)! >= today()}
            onClick={() => shiftPeriod(1)}
          >
            <ChevronRight size={17} />
          </IconButton>
        </div>
      </div>

      {tab === "energy" && (
        <EnergyPanel dates={dates} anchor={anchor} onOpenDiary={openRecord} />
      )}
      {tab === "diet" && (
        <>
          <div className="coverage-summary" role="status">
            <strong>
              {stats.confirmed} de{" "}
              {dates.filter((date) => date <= today()).length} dias confirmados
            </strong>
            <p>
              {stats.incomplete} parciais · {stats.denominator} dias usados no
              balanço.
            </p>
          </div>
          <div className="stats-row three">
            <StatCard
              label="Calorias registradas"
              value={fmt(stats.total.calories)}
              unit="kcal"
              detail={stats.recorded + " dias com registros"}
              icon={<Flame size={19} />}
            />
            <StatCard
              label="Média diária"
              value={
                stats.recorded
                  ? fmt(stats.total.calories / stats.recorded)
                  : "—"
              }
              unit="kcal"
              detail="Por dia com alimentação registrada"
              icon={<Activity size={19} />}
            />
            <StatCard
              label="Dentro da meta"
              value={stats.adherence === null ? "—" : String(stats.adherence)}
              unit={stats.adherence === null ? "" : "%"}
              detail={
                stats.adherent +
                " de " +
                stats.denominator +
                " dias confirmados anteriores · ±10%"
              }
              icon={<Target size={19} />}
            />
          </div>
          <section
            className="calorie-balance-summary"
            aria-label="Balanço calórico do período"
          >
            <div className="calorie-balance-grid">
              <div className="calorie-excess">
                <StatCard
                  label="Calorias acima da meta"
                  value={stats.denominator ? fmt(stats.excessCalories) : "—"}
                  unit={stats.denominator ? "kcal" : ""}
                  detail={`${stats.daysAbove} dias acima da meta`}
                  icon={<TrendingUp size={19} />}
                />
              </div>
              <div className="calorie-below">
                <StatCard
                  label="Calorias abaixo da meta"
                  value={stats.denominator ? fmt(stats.belowCalories) : "—"}
                  unit={stats.denominator ? "kcal" : ""}
                  detail={`${stats.daysBelow} dias abaixo da meta`}
                  icon={<Target size={19} />}
                />
              </div>
            </div>
            <details className="quiet-details">
              <summary>Regras do balanço</summary>
              <p className="chart-description">
                {stats.denominator} dias encerrados, confirmados e com meta no
                período. Somamos as diferenças de cada dia separadamente, sem
                compensar excessos com faltas. Hoje e registros não confirmados
                ficam fora destes totais. A comparação usa a meta vigente em
                cada data. Totais e médias incluem os dias com registros, mesmo
                parciais.
              </p>
            </details>
          </section>
          <section className="card chart-card">
            <SectionHeading
              title="Alimentação ao longo do tempo"
              action={<span className="subtle-badge">CALORIAS · KCAL</span>}
            />
            <p className="chart-description">
              Vermelho: acima da meta.{" "}
              {period === "day"
                ? "Refeições acumuladas por horário."
                : "Linha: meta de cada dia."}{" "}
              Hoje e dias não confirmados são parciais.
            </p>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 12, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#203b53"
                    vertical={false}
                    strokeDasharray="3 5"
                  />
                  <XAxis
                    dataKey="label"
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f4f0e804" }}
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as
                        (typeof chartData)[number] | undefined;
                      if (!active || !row) return null;
                      return (
                        <div className="calorie-tooltip" style={tooltipStyle}>
                          <strong>
                            {period === "day" ? row.label : dateLabel(row.date)}
                          </strong>
                          <p>
                            {row.calories === null
                              ? "Sem dados"
                              : `Consumido: ${fmt(row.calories)} kcal`}
                          </p>
                          <p>
                            Meta diária:{" "}
                            {row.goal === null
                              ? "sem meta"
                              : `${fmt(row.goal)} kcal`}
                          </p>
                          {row.excess !== null && row.excess > 0 && (
                            <p className="calorie-excess-text">
                              Acima da meta: {fmt(row.excess)} kcal
                            </p>
                          )}
                          {row.calories !== null && (
                            <p>
                              {data.confirmedFoodDays?.includes(row.date)
                                ? "Registro confirmado"
                                : "Registro em andamento"}
                              {row.date === today() ? " · hoje parcial" : ""}
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
                  <Bar
                    isAnimationActive={false}
                    dataKey="withinGoal"
                    stackId="calories"
                    name="Consumo até a meta"
                    fill="#f4f0e8"
                    maxBarSize={36}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="excess"
                    stackId="calories"
                    name="Acima da meta"
                    fill="#ff8585"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={36}
                  />
                  {period !== "day" && (
                    <Line
                      type="stepAfter"
                      dataKey="goal"
                      name="Meta do dia"
                      stroke="#8d9eb1"
                      strokeDasharray="5 5"
                      dot={false}
                      strokeWidth={2}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {!stats.recorded && (
              <p className="muted center">
                Sem registros neste período. Registre uma refeição para começar.
              </p>
            )}
          </section>
          <div className="nutrition-period-macros">
            <div className="card">
              <span className="protein-dot">PROTEÍNAS</span>
              <strong>
                {fmt(stats.total.protein)} <small>g</small>
              </strong>
              <p>
                {stats.recorded
                  ? "Média: " +
                    fmt(stats.total.protein / stats.recorded) +
                    " g/dia"
                  : "Sem dados"}
              </p>
            </div>
            <div className="card">
              <span className="carbs-dot">CARBOIDRATOS</span>
              <strong>
                {fmt(stats.total.carbs)} <small>g</small>
              </strong>
              <p>
                {stats.recorded
                  ? "Média: " +
                    fmt(stats.total.carbs / stats.recorded) +
                    " g/dia"
                  : "Sem dados"}
              </p>
            </div>
            <div className="card">
              <span className="fat-dot">GORDURAS</span>
              <strong>
                {fmt(stats.total.fat)} <small>g</small>
              </strong>
              <p>
                {stats.recorded
                  ? "Média: " + fmt(stats.total.fat / stats.recorded) + " g/dia"
                  : "Sem dados"}
              </p>
            </div>
          </div>
          <section className="card table-card">
            <SectionHeading title="Um dia de cada vez" />
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Calorias</th>
                    <th>Proteína / meta</th>
                    <th>Meta calórica</th>
                    <th>Diferença da meta</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {dates
                    .filter((d) => d <= today())
                    .slice()
                    .reverse()
                    .map((date) => {
                      const recorded = data.meals.some(
                        (m) => m.date === date && m.items.length,
                      );
                      const m = dayMacros(data, date);
                      const g = goalAt(data, date);
                      const confirmed =
                        recorded && !!data.confirmedFoodDays?.includes(date);
                      const hit =
                        recorded &&
                        g &&
                        Math.abs(m.calories - g.calories) <= g.calories * 0.1;
                      return (
                        <tr key={date}>
                          <td data-label="Dia">{dateLabel(date)}</td>
                          <td data-label="Calorias">
                            {recorded ? fmt(m.calories) + " kcal" : "—"}
                          </td>
                          <td data-label="Proteína / meta">
                            {recorded
                              ? fmt(m.protein) +
                                " / " +
                                (g ? fmt(g.protein) : "—") +
                                " g"
                              : "—"}
                          </td>
                          <td data-label="Meta calórica">
                            {g ? fmt(g.calories) + " kcal" : "—"}
                          </td>
                          <td
                            data-label="Diferença da meta"
                            className={
                              recorded && g && m.calories > g.calories
                                ? "calorie-excess-text"
                                : ""
                            }
                          >
                            {!recorded || !g
                              ? "—"
                              : m.calories === g.calories
                                ? "Na meta"
                                : `${fmt(Math.abs(m.calories - g.calories))} kcal ${m.calories > g.calories ? "acima" : "abaixo"}`}
                            {recorded && g && (date === today() || !confirmed)
                              ? " · parcial"
                              : ""}
                          </td>
                          <td data-label="Status">
                            <span
                              className={
                                "status-pill " + (confirmed ? "success" : "")
                              }
                            >
                              {!recorded
                                ? "Sem registros"
                                : confirmed
                                  ? "Confirmado"
                                  : "Em andamento"}
                            </span>
                            {confirmed && g && date < today() && (
                              <small className="record-detail">
                                {hit
                                  ? "Na faixa da meta"
                                  : "Fora da faixa da meta"}
                              </small>
                            )}
                          </td>
                          <td data-label="Ações">
                            <IconButton
                              label={"Abrir diário de " + dateLabel(date)}
                              onClick={() => openRecord("/?date=" + date)}
                            >
                              <ArrowRight size={16} />
                            </IconButton>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {tab === "training" && (
        <>
          <div className="stats-row three">
            <StatCard
              label="Treinos no período"
              value={String(filteredSessions.length)}
              detail="Somente sessões concluídas"
              icon={<Dumbbell size={19} />}
            />
            <StatCard
              label="Tempo de movimento"
              value={fmt(
                filteredSessions.reduce((v, s) => v + s.duration, 0) / 60,
              )}
              unit="min"
              detail="Cada minuto também conta"
              icon={<Activity size={19} />}
            />
            <StatCard
              label="Volume total"
              value={fmt(
                weightDisplay(
                  filteredSessions.reduce((v, s) => v + volume(s), 0),
                  data.profile.units,
                ),
              )}
              unit={weightUnit(data.profile)}
              detail="Carga × repetições das séries concluídas"
              icon={<TrendingUp size={19} />}
            />
          </div>
          <section className="card chart-card">
            <SectionHeading
              title="Sua força em evolução"
              action={
                <select
                  aria-label="Exercício para acompanhar"
                  value={exercise}
                  onChange={(e) => setExercise(e.target.value)}
                >
                  {!exerciseOptions.some(([id]) => id === exercise) && (
                    <option value={exercise}>Supino reto</option>
                  )}
                  {exerciseOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              }
            />
            <p className="chart-description">
              Maior carga concluída e suas repetições em cada sessão.
            </p>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={progression}
                  margin={{ top: 15, right: 0, left: -15, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#203b53"
                    vertical={false}
                    strokeDasharray="3 5"
                  />
                  <XAxis
                    dataKey="label"
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="weight"
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="reps"
                    orientation="right"
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
                  <Bar
                    yAxisId="weight"
                    dataKey="weight"
                    name={"Carga (" + weightUnit(data.profile) + ")"}
                    fill="#b7c9e2"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={35}
                  />
                  <Line
                    yAxisId="reps"
                    dataKey="reps"
                    name="Repetições"
                    stroke="#f4f0e8"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {!progression.length && (
              <p className="center muted">
                Sem séries deste exercício no período selecionado.
              </p>
            )}
          </section>
          <section className="card frequency-card">
            <SectionHeading title="Constância semanal" />
            {weeklyGoals.map((w) => (
              <div className="frequency-row" key={w.start}>
                <span>Semana de {dateLabel(w.start)}</span>
                <div className="bar-track">
                  <div
                    style={{
                      width:
                        Math.min(
                          100,
                          w.target ? (w.count / w.target) * 100 : 0,
                        ) + "%",
                    }}
                  />
                </div>
                <strong>
                  {w.target
                    ? `${w.count} / ${w.target} treinos`
                    : `${w.count} treinos · sem meta`}
                </strong>
              </div>
            ))}
            <p className="muted small">
              Semanas completas, de segunda a domingo, que cruzam o período. A
              meta é a vigente na segunda-feira.
            </p>
          </section>
          <SectionHeading title="Treinos registrados" />
          {!filteredSessions.length ? (
            <Empty
              icon={<Dumbbell />}
              title="Espaço para sua próxima conquista"
              description="Nenhum treino concluído neste período."
            />
          ) : (
            filteredSessions
              .slice()
              .reverse()
              .map((s) => (
                <button
                  className="card history-row"
                  key={s.id}
                  onClick={() =>
                    openRecord("/treinos?tab=history&session=" + s.id)
                  }
                >
                  <span className="history-date">
                    <strong>{dateLabel(s.date, { day: "numeric" })}</strong>
                    <small>{dateLabel(s.date, { month: "short" })}</small>
                  </span>
                  <span className="history-info">
                    <strong>{s.name}</strong>
                    <small>
                      {Math.round(s.duration / 60)} min · {s.exercises.length}{" "}
                      exercícios
                    </small>
                  </span>
                  <ChevronRight size={19} />
                </button>
              ))
          )}
        </>
      )}
      {tab === "body" && (
        <>
          <div className="stats-row three">
            <StatCard
              label="Último peso"
              value={
                latest
                  ? fmt(weightDisplay(latest.weight, data.profile.units), 1)
                  : "—"
              }
              unit={weightUnit(data.profile)}
              detail={
                latest
                  ? "Registrado em " + dateLabel(latest.date)
                  : "Registre sua primeira medição"
              }
              icon={<Scale size={19} />}
            />
            <StatCard
              label="Mudança desde o início"
              value={
                latest && first
                  ? fmt(
                      weightDisplay(
                        latest.weight - first.weight,
                        data.profile.units,
                      ),
                      1,
                    )
                  : "—"
              }
              unit={weightUnit(data.profile)}
              detail="Comparado ao primeiro registro"
              icon={<TrendingUp size={19} />}
            />
            <StatCard
              label="Até seu objetivo"
              value={
                latest
                  ? fmt(
                      weightDisplay(
                        Math.abs(latest.weight - data.profile.targetWeight),
                        data.profile.units,
                      ),
                      1,
                    )
                  : "—"
              }
              unit={weightUnit(data.profile)}
              detail={
                "Meta de " +
                fmt(
                  weightDisplay(data.profile.targetWeight, data.profile.units),
                  1,
                ) +
                " " +
                weightUnit(data.profile)
              }
              icon={<Target size={19} />}
            />
            <StatCard
              label="Cintura"
              value={
                latest?.waist
                  ? fmt(lengthDisplay(latest.waist, data.profile.units), 1)
                  : "—"
              }
              unit={lengthUnit(data.profile)}
              detail={
                data.profile.targetWaist > 0
                  ? "Objetivo: " +
                    fmt(
                      lengthDisplay(
                        data.profile.targetWaist,
                        data.profile.units,
                      ),
                      1,
                    ) +
                    " " +
                    lengthUnit(data.profile)
                  : "Objetivo não definido"
              }
              icon={<Ruler size={19} />}
            />
          </div>
          <section className="card chart-card">
            <SectionHeading
              title="Sua evolução, no seu ritmo"
              action={
                <Segmented
                  label="Medida no gráfico"
                  value={metric}
                  onChange={setMetric}
                  options={[
                    { value: "weight", label: "Peso" },
                    { value: "waist", label: "Cintura" },
                    { value: "arm", label: "Braço" },
                  ]}
                />
              }
            />
            <p className="chart-description">
              {target > 0
                ? "Registros do período comparados ao seu objetivo atual, sem projeções."
                : "Registros do período. Você ainda não definiu uma meta para esta medida."}
            </p>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={selectedMeasurements
                    .filter((m) => m[metric] > 0)
                    .map((m) => ({
                      label: dateLabel(m.date),
                      value: +measurementValue(m).toFixed(1),
                    }))}
                  margin={{ top: 15, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="bodyGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0" stopColor="#f4f0e8" stopOpacity={0.24} />
                      <stop offset="1" stopColor="#f4f0e8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="#203b53"
                    vertical={false}
                    strokeDasharray="3 5"
                  />
                  <XAxis
                    dataKey="label"
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [
                      fmt(Number(v), 1) +
                        " " +
                        (metric === "weight"
                          ? weightUnit(data.profile)
                          : lengthUnit(data.profile)),
                      "Registro",
                    ]}
                  />
                  {target > 0 && (
                    <ReferenceLine
                      y={target}
                      stroke="#647887"
                      strokeDasharray="5 5"
                      ifOverflow="extendDomain"
                      label={{
                        value: "Meta: " + fmt(target, 1),
                        fill: "#8fa0b3",
                        fontSize: 11,
                        position: "insideBottomRight",
                      }}
                    />
                  )}
                  <Area
                    type="linear"
                    dataKey="value"
                    stroke="#f4f0e8"
                    fill="url(#bodyGradient)"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "#f4f0e8",
                      stroke: "#162f45",
                      strokeWidth: 3,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {!selectedMeasurements.length && (
              <p className="center muted">
                Nenhuma medição neste período. Use as setas para consultar
                outras datas.
              </p>
            )}
          </section>
          <section className="card table-card">
            <SectionHeading title="Registro de medidas" />
            <ErrorBox message={task.error} />
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Peso ({weightUnit(data.profile)})</th>
                    <th>Cintura ({lengthUnit(data.profile)})</th>
                    <th>Braço ({lengthUnit(data.profile)})</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selectedMeasurements
                    .slice()
                    .reverse()
                    .map((m) => (
                      <tr key={m.id}>
                        <td data-label="Data">{dateLabel(m.date)}</td>
                        <td data-label="Peso">
                          {fmt(weightDisplay(m.weight, data.profile.units), 1)}
                        </td>
                        <td data-label="Cintura">
                          {m.waist
                            ? fmt(lengthDisplay(m.waist, data.profile.units), 1)
                            : "—"}
                        </td>
                        <td data-label="Braço">
                          {m.arm
                            ? fmt(lengthDisplay(m.arm, data.profile.units), 1)
                            : "—"}
                        </td>
                        <td data-label="Ações">
                          <div className="button-row">
                            <IconButton
                              label={"Editar medição de " + dateLabel(m.date)}
                              onClick={() => setEditing(m)}
                            >
                              <Pencil size={16} />
                            </IconButton>
                            <IconButton
                              label={"Excluir medição de " + dateLabel(m.date)}
                              onClick={() => remove(m)}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <SectionHeading
            title="Sua evolução também se vê"
            action={<span className="muted small">Fotos do período</span>}
          />
          <div className="progress-gallery">
            {selectedMeasurements
              .filter((m) => m.photo)
              .map((m) => (
                <button
                  className="progress-photo card"
                  key={m.id}
                  onClick={() => setPhoto(m)}
                >
                  <img
                    src={m.photo}
                    alt={"Progresso em " + dateLabel(m.date)}
                  />
                  <div>
                    <strong>{dateLabel(m.date)}</strong>
                    <span>
                      {fmt(weightDisplay(m.weight, data.profile.units), 1)}{" "}
                      {weightUnit(data.profile)}
                    </span>
                  </div>
                </button>
              ))}
            <button
              className="add-progress-photo"
              onClick={() => setEditing("new")}
            >
              <Camera size={30} />
              <strong>Um novo registro</strong>
              <span>Guarde essa conquista.</span>
              <Plus size={20} />
            </button>
          </div>
        </>
      )}
      {editing && (
        <MeasurementEditor
          measurement={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {photo && (
        <Modal
          title={"Seu progresso · " + dateLabel(photo.date)}
          onClose={() => setPhoto(null)}
        >
          <img
            className="progress-full"
            src={photo.photo}
            alt="Foto do progresso selecionada"
          />
          {photo.photo === "/progress.svg" && (
            <p className="muted center">
              Ilustração demonstrativa; não representa uma pessoa real.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
function MeasurementEditor({
  measurement,
  onClose,
}: {
  measurement?: Measurement;
  onClose: () => void;
}) {
  const data = useData();
  const { update, notify } = useApp();
  const [draft, setDraft] = useState<Measurement>(
    measurement
      ? { ...measurement }
      : {
          id: uid(),
          date: today(),
          weight: data.profile.weight,
          waist: 0,
          arm: 0,
        },
  );
  const task = useFormTask();
  const fileRef = useRef<HTMLInputElement>(null);
  const save = () =>
    task.run(async () => {
      if (
        data.measurements.some(
          (m) => m.date === draft.date && m.id !== draft.id,
        )
      )
        throw new Error(
          "Já existe uma medição nesta data. Edite o registro existente ou escolha outra data.",
        );
      await update((d) => {
        const measurements = [
          ...d.measurements.filter((m) => m.id !== draft.id),
          draft,
        ];
        const latest = [...measurements].sort((a, b) =>
          b.date.localeCompare(a.date),
        )[0];
        return {
          ...d,
          measurements,
          profile: { ...d.profile, weight: latest.weight },
        };
      });
      notify("Mais um ponto na sua evolução!");
      onClose();
    });
  return (
    <Modal
      title={measurement ? "Editar medição" : "Um novo registro seu"}
      subtitle="Registre seu momento. A evolução acontece com o tempo."
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Data da medição">
          <DateInput
            max={today()}
            value={draft.date}
            required
            onValueChange={(value) => setDraft({ ...draft, date: value })}
          />
        </Field>
        <NumberField
          label="Peso"
          value={weightDisplay(draft.weight, data.profile.units)}
          suffix={weightUnit(data.profile)}
          min={1}
          onChange={(v) =>
            setDraft({
              ...draft,
              weight: weightInternal(v, data.profile.units),
            })
          }
        />
        <div className="form-grid">
          <NumberField
            label="Cintura"
            value={lengthDisplay(draft.waist, data.profile.units)}
            suffix={lengthUnit(data.profile)}
            onChange={(v) =>
              setDraft({
                ...draft,
                waist: lengthInternal(v, data.profile.units),
              })
            }
          />
          <NumberField
            label="Braço"
            value={lengthDisplay(draft.arm, data.profile.units)}
            suffix={lengthUnit(data.profile)}
            onChange={(v) =>
              setDraft({ ...draft, arm: lengthInternal(v, data.profile.units) })
            }
          />
        </div>
        <p className="muted small">
          Deixe cintura ou braço em zero se não mediu. Valores ausentes não
          entram nos gráficos.
        </p>
        <input
          type="file"
          className="visually-hidden"
          ref={fileRef}
          accept="image/jpeg,image/png,image/webp"
          aria-label="Foto do progresso"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              void task.run(async () =>
                setDraft({ ...draft, photo: await compressPhoto(file) }),
              );
            e.target.value = "";
          }}
        />
        {draft.photo ? (
          <div className="measurement-photo">
            <img src={draft.photo} alt="Prévia do progresso" />
            <IconButton
              type="button"
              label="Remover foto do progresso"
              onClick={() => setDraft({ ...draft, photo: undefined })}
            >
              <X size={17} />
            </IconButton>
          </div>
        ) : (
          <button
            type="button"
            className="upload-zone compact"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={26} />
            <strong>Adicionar foto de progresso</strong>
            <span>Opcional · JPG, PNG ou WebP · Até 15 MB</span>
          </button>
        )}
        <ErrorBox message={task.error} />
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <SaveButton busy={task.busy}>Salvar medição</SaveButton>
        </div>
      </form>
    </Modal>
  );
}
