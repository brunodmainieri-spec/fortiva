import { DateInput } from "./date-input";
import { ExplainButton } from "./assistant";
import { FoodLibrary } from "./food-library";
import {
  cloneFoods,
  saveMeal as saveMealData,
  removeMeal as removeMealData,
} from "./food-data";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Utensils,
  X,
} from "lucide-react";
import { useApp, useData } from "./store";
import {
  dateLabel,
  dayMacros,
  fmt,
  food,
  goalAt,
  MACRO_LABELS,
  macroEnergy,
  MEAL_TYPES,
  periodDates,
  scaleItem,
  shiftDate,
  sumMacros,
  today,
  uid,
  weightDisplay,
  weightUnit,
} from "./domain";
import type { FoodItem, Macros, Meal, MealDraft } from "./domain";
import { compressPhoto, nutritionAI } from "./services";
import {
  Button,
  ErrorBox,
  Field,
  IconButton,
  MacroBar,
  MacroChips,
  MealArt,
  Modal,
  NumberField,
  PageTitle,
  Ring,
  SaveButton,
  SectionHeading,
  Segmented,
  TextLink,
  useFormTask,
} from "./ui";

export function Dashboard() {
  const data = useData();
  const { update, notify } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const candidate = params.get("date");
  const date =
    candidate &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate) &&
    !isNaN(new Date(candidate + "T12:00:00").getTime())
      ? candidate
      : today();
  const setDate = (d: string) => setParams(d === today() ? {} : { date: d });
  const meals = data.meals
    .filter((m) => m.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
  const hasFoodRecords = meals.some((m) => m.items.length > 0);
  const macros = dayMacros(data, date);
  const goal = goalAt(data, date);
  const remaining = (goal?.calories ?? 0) - macros.calories;
  const [editing, setEditing] = useState<Meal | "new" | null>(null);
  const [entryMode, setEntryMode] = useState<"quick" | "photo">("quick");
  const [mealType, setMealType] = useState("Almoço");
  const task = useFormTask();
  const active = data.plans.find((p) => p.active);
  const running = data.sessions.find((s) => !s.finishedAt);
  const week = periodDates(date, "week");
  const weekSessions = data.sessions.filter(
    (s) => s.finishedAt && week.includes(s.date),
  );
  const measurements = [...data.measurements].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const latest = measurements.at(-1);
  const first = measurements[0];
  const difference = latest && first ? latest.weight - first.weight : 0;
  const add = (type = "Almoço") => {
    setEntryMode("quick");
    setMealType(type);
    setEditing("new");
  };
  const confirmed = Boolean(data.confirmedFoodDays?.includes(date));
  const changeConfirmation = () =>
    task.run(async () => {
      if (!hasFoodRecords) return;
      await update((d) => ({
        ...d,
        confirmedFoodDays: confirmed
          ? (d.confirmedFoodDays ?? []).filter((v) => v !== date)
          : [...new Set([...(d.confirmedFoodDays ?? []), date])],
      }));
      notify(
        confirmed
          ? "Dia reaberto para revisão."
          : "Registros do dia confirmados.",
      );
    });
  const remove = (meal: Meal) => {
    void task.run(async () => {
      await update((d) => removeMealData(d, meal));
      notify("Refeição excluída.", () =>
        update((d) => ({
          ...d,
          meals: d.meals.some((m) => m.id === meal.id)
            ? d.meals
            : [...d.meals, meal],
        })),
      );
    });
  };
  return (
    <>
      <PageTitle
        title={"Olá, " + data.profile.name.split(" ")[0] + " 👋"}
        action={
          <Button onClick={() => add()}>
            <Plus size={18} />
            Registrar refeição
          </Button>
        }
      />
      <div className="day-toolbar">
        <div className="day-title">
          <span className="live-dot" />
          <h2>
            {date === today()
              ? "Seu dia, em equilíbrio"
              : dateLabel(date, { day: "numeric", month: "long" })}
          </h2>
        </div>
        <div className="date-switch">
          <IconButton
            label="Dia anterior"
            onClick={() => setDate(shiftDate(date, -1))}
          >
            <ChevronLeft size={17} />
          </IconButton>
          <DateInput
            aria-label="Data do diário"
            value={date}
            max={today()}
            onValueChange={(value) =>
              value && value <= today() && setDate(value)
            }
          />
          <IconButton
            label="Próximo dia"
            disabled={date >= today()}
            onClick={() => setDate(shiftDate(date, 1))}
          >
            <ChevronRight size={17} />
          </IconButton>
        </div>
      </div>
      <section className="food-day-status" aria-label="Preenchimento do diário">
        <div>
          <strong>
            {!hasFoodRecords
              ? "Sem registros"
              : confirmed
                ? "Dia confirmado"
                : "Registro em andamento"}
          </strong>
          <p>
            {!hasFoodRecords
              ? "Registre sua primeira refeição."
              : confirmed
                ? "Alterações reabrem o dia para revisão."
                : "Confirme ao terminar. Dias parciais ficam fora do balanço final."}
          </p>
          {confirmed && date === today() && (
            <p>Hoje ainda é parcial nos indicadores até o dia encerrar.</p>
          )}
        </div>
        {hasFoodRecords && (
          <Button
            variant="secondary"
            aria-label={
              confirmed
                ? "Reabrir registros do dia"
                : "Concluí os registros do dia"
            }
            loading={task.busy}
            onClick={() => void changeConfirmation()}
          >
            {confirmed ? "Reabrir dia" : "Confirmar dia"}
          </Button>
        )}
      </section>
      {Object.entries(data.mealDrafts ?? {}).length > 0 && (
        <section
          className="card meal-drafts"
          aria-label="Rascunhos de refeições"
        >
          <h3>Continue de onde parou</h3>
          {Object.entries(data.mealDrafts ?? {}).map(([key, draft]) => (
            <div className="draft-row" key={key}>
              <span>
                {draft.meal.type} · {dateLabel(draft.meal.date)} ·{" "}
                {draft.meal.items.length} alimentos
              </span>
              <Button
                variant="secondary"
                onClick={() => {
                  setMealType(draft.meal.type);
                  setEditing(
                    draft.originalId
                      ? (data.meals.find((m) => m.id === draft.originalId) ??
                          "new")
                      : "new",
                  );
                }}
              >
                Continuar registro
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  void task.run(async () => {
                    if (
                      !window.confirm(
                        "Descartar este rascunho? Refeições já salvas não serão alteradas.",
                      )
                    )
                      return;
                    await update((d) => {
                      const drafts = { ...d.mealDrafts };
                      delete drafts[key];
                      return { ...d, mealDrafts: drafts };
                    });
                  })
                }
              >
                Descartar rascunho
              </Button>
            </div>
          ))}
        </section>
      )}
      <div className="nutrition-overview">
        <section className="card calorie-card">
          <div className="card-title">
            <span className="label-icon lime">
              <Flame size={17} />
            </span>
            <h3>Balanço de calorias</h3>
            <ExplainButton selection={{ topic: "calories", dates: [date] }} />
          </div>
          <div className="calorie-content">
            <Ring value={macros.calories} goal={goal?.calories ?? 0} />
            <div
              className={
                "calorie-details " +
                (goal && remaining < 0 ? "calorie-over-goal" : "")
              }
            >
              <span className="eyebrow">
                {date < today() ? "BALANÇO DO DIA" : "AINDA NO SEU DIA"}
              </span>
              <strong>
                {goal && (hasFoodRecords || date >= today())
                  ? fmt(Math.abs(remaining))
                  : "—"}
                <small>kcal</small>
              </strong>
              <p>
                {!goal
                  ? "Nenhuma meta para esta data"
                  : !hasFoodRecords && date < today()
                    ? "Sem registros neste dia"
                    : remaining >= 0
                      ? date < today()
                        ? "abaixo da meta do dia"
                        : "disponíveis para consumir"
                      : "acima da meta do dia"}
              </p>
              <div className="mini-divider" />
              <div className="calorie-target">
                <Target size={16} />
                <span>Sua meta</span>
                <b>{goal ? fmt(goal.calories) : "—"} kcal</b>
              </div>
              <button className="text-link" onClick={() => navigate("/perfil")}>
                Ajustar minha meta
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </section>
        <section className="card macros-card">
          <div className="card-title">
            <span className="label-icon purple">
              <Utensils size={17} />
            </span>
            <h3>Seus macronutrientes</h3>
            <ExplainButton selection={{ topic: "macros", dates: [date] }} />
          </div>
          <div className="macro-bars">
            {(["protein", "carbs", "fat"] as const).map((name) => (
              <MacroBar
                key={name}
                name={name}
                value={macros[name]}
                goal={goal?.[name] ?? null}
              />
            ))}
          </div>
          <div className="macro-bottom">
            <span className="round-check">
              <Check size={13} />
            </span>
            <span>{meals.length} refeições registradas</span>
          </div>
        </section>
      </div>
      <div className="dashboard-grid">
        <div>
          <SectionHeading
            title="Suas refeições"
            count={meals.length}
            action={
              <button
                type="button"
                className="text-link meal-photo-shortcut"
                aria-label="Registrar refeição por foto"
                onClick={() => {
                  setEntryMode("photo");
                  setMealType("Almoço");
                  setEditing("new");
                }}
              >
                <Camera size={16} />
                Por foto
              </button>
            }
          />
          <ErrorBox message={task.error} />
          {!hasFoodRecords && (
            <p className="muted">Nenhuma refeição registrada neste dia.</p>
          )}
          <div className="meal-list">
            {MEAL_TYPES.filter(
              (type) => type !== "Ceia" || meals.some((m) => m.type === type),
            ).map((type) => {
              const entries = meals.filter((m) => m.type === type);
              return entries.length
                ? entries.map((meal) => (
                    <article className="card meal-card" key={meal.id}>
                      <MealArt
                        type={type}
                        photo={meal.items.find((i) => i.photo)?.photo}
                      />
                      <div className="meal-main">
                        <div className="meal-title">
                          <h3>{type}</h3>
                          <span>
                            <Clock3 size={12} />
                            {meal.time}
                          </span>
                        </div>
                        <p>{meal.items.map((i) => i.name).join(" · ")}</p>
                        <MacroChips macros={sumMacros(meal.items)} />
                      </div>
                      <div className="meal-aside">
                        <strong>
                          {fmt(sumMacros(meal.items).calories)}
                          <small>kcal</small>
                        </strong>
                        <div>
                          <IconButton
                            label={"Editar " + type}
                            onClick={() => setEditing(meal)}
                          >
                            <Pencil size={15} />
                          </IconButton>
                          <IconButton
                            label={"Excluir " + type}
                            onClick={() => remove(meal)}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </div>
                    </article>
                  ))
                : null;
            })}
          </div>
          <details className="quiet-details meal-types">
            <summary>Adicionar outra refeição</summary>
            <div className="button-row">
              {MEAL_TYPES.map((type) => (
                <Button key={type} variant="ghost" onClick={() => add(type)}>
                  {type}
                </Button>
              ))}
            </div>
          </details>
        </div>
        <aside className="dashboard-aside">
          <section className="workout-feature">
            <div className="workout-feature-top">
              <span className="muted small">Treino</span>
              <span className="subtle-badge">{data.profile.minutes} min</span>
            </div>

            <h3>
              {running
                ? "Continue de onde parou"
                : active
                  ? "Seu próximo treino"
                  : "Encontre seu ritmo"}
            </h3>
            <p>
              {running?.name ??
                active?.days[
                  weekSessions.length % Math.max(1, active.days.length)
                ]?.name ??
                "Monte um plano que combina com você."}
            </p>

            <Button onClick={() => navigate("/treinos")}>
              {running
                ? "Retomar treino"
                : active
                  ? "Ver meu treino"
                  : "Criar meu plano"}
              <ArrowRight size={16} />
            </Button>
          </section>
          <section className="card weight-mini">
            <div className="card-title">
              <span className="label-icon blue">
                <Scale size={17} />
              </span>
              <h3>Peso atual</h3>
            </div>
            <div className="weight-mini-value">
              <strong>
                {latest
                  ? fmt(weightDisplay(latest.weight, data.profile.units), 1)
                  : "—"}
                <span>{weightUnit(data.profile)}</span>
              </strong>
              {latest && first && (
                <span className="trend-badge">
                  <ArrowDownRight size={13} />
                  {fmt(
                    weightDisplay(Math.abs(difference), data.profile.units),
                    1,
                  )}{" "}
                  {weightUnit(data.profile)}{" "}
                  {difference <= 0 ? "a menos" : "a mais"}
                </span>
              )}
            </div>
            {measurements.length > 1 ? (
              <svg
                className="sparkline"
                viewBox="0 0 300 65"
                preserveAspectRatio="none"
                aria-label="Tendência de peso"
              >
                <defs>
                  <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f4f0e8" stopOpacity=".18" />
                    <stop offset="1" stopColor="#f4f0e8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={
                    "M0,65 L" +
                    measurements
                      .map(
                        (m, i) =>
                          (i / (measurements.length - 1)) * 300 +
                          "," +
                          (8 +
                            ((Math.max(...measurements.map((v) => v.weight)) -
                              m.weight) /
                              Math.max(
                                1,
                                Math.max(...measurements.map((v) => v.weight)) -
                                  Math.min(
                                    ...measurements.map((v) => v.weight),
                                  ),
                              )) *
                              40),
                      )
                      .join(" L") +
                    " L300,65 Z"
                  }
                  fill="url(#weight-fill)"
                />
                <polyline
                  points={measurements
                    .map(
                      (m, i) =>
                        (i / (measurements.length - 1)) * 300 +
                        "," +
                        (8 +
                          ((Math.max(...measurements.map((v) => v.weight)) -
                            m.weight) /
                            Math.max(
                              1,
                              Math.max(...measurements.map((v) => v.weight)) -
                                Math.min(...measurements.map((v) => v.weight)),
                            )) *
                            40),
                    )
                    .join(" ")}
                  fill="none"
                  stroke="#f4f0e8"
                  strokeWidth="2"
                />
              </svg>
            ) : (
              <p className="muted small">
                Registre seu peso para acompanhar a curva.
              </p>
            )}
            <div className="weight-mini-footer">
              <span>
                Objetivo:{" "}
                {fmt(
                  weightDisplay(data.profile.targetWeight, data.profile.units),
                  1,
                )}{" "}
                {weightUnit(data.profile)}
              </span>
              <TextLink onClick={() => navigate("/evolucao?tab=body")}>
                Ver evolução
              </TextLink>
            </div>
          </section>
        </aside>
      </div>
      <section className="card week-card">
        <div className="week-heading">
          <div>
            <h2>Sua semana</h2>
            <p>
              {weekSessions.length} de{" "}
              {goal?.frequency ?? data.profile.frequency} treinos ·{" "}
              {week.filter((d) => data.meals.some((m) => m.date === d)).length}{" "}
              dias com refeições registradas
            </p>
          </div>
          <TextLink onClick={() => navigate("/evolucao")}>
            Ver histórico completo
          </TextLink>
        </div>
        <div className="week-days">
          {week.map((d) => {
            const has = data.meals.some((m) => m.date === d);
            const trained = data.sessions.some(
              (s) => s.date === d && s.finishedAt,
            );
            return (
              <button
                key={d}
                className={
                  "week-day " +
                  (d === date ? "selected " : "") +
                  (d > today() ? "future" : "")
                }
                onClick={() => setDate(d)}
              >
                <span>
                  {dateLabel(d, { weekday: "short" }).replace(".", "")}
                </span>
                <div className={has ? "logged" : ""}>
                  {has ? <Check size={18} /> : dateLabel(d, { day: "numeric" })}
                </div>
                <small>
                  {trained ? (
                    <Dumbbell size={12} />
                  ) : has ? (
                    "Registrado"
                  ) : d > today() ? (
                    "Em breve"
                  ) : (
                    "Sem registro"
                  )}
                </small>
              </button>
            );
          })}
        </div>
      </section>
      {editing && (
        <MealEditor
          meal={editing === "new" ? undefined : editing}
          date={date}
          initialType={mealType}
          initialMode={entryMode}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
function ItemEditor({
  item,
  onChange,
  onRemove,
  index,
}: {
  item: FoodItem;
  onChange: (item: FoodItem) => void;
  onRemove: () => void;
  index: number;
}) {
  return (
    <div className="item-editor">
      <div className="item-editor-heading">
        <span className="item-number">{index + 1}</span>
        <strong>Alimento</strong>
        <IconButton
          type="button"
          label={"Remover alimento " + (index + 1)}
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </IconButton>
      </div>
      <Field label="Nome do alimento">
        <input
          value={item.name}
          required
          maxLength={100}
          placeholder="Ex.: pão integral"
          onChange={(e) => onChange({ ...item, name: e.target.value })}
        />
      </Field>
      <div className="form-grid">
        <NumberField
          label="Porção"
          value={item.portion}
          min={0.1}
          onChange={(portion) =>
            onChange(
              Number.isFinite(portion) && portion > 0
                ? scaleItem(item, portion)
                : { ...item, portion },
            )
          }
        />
        <Field label="Unidade da porção">
          <select
            value={item.unit}
            onChange={(e) => onChange({ ...item, unit: e.target.value })}
          >
            <option value="g">Gramas (g)</option>
            <option value="ml">Mililitros (ml)</option>
            <option value="un">Unidades</option>
          </select>
        </Field>
      </div>
      <div className="macro-inputs">
        {(Object.keys(MACRO_LABELS) as (keyof Macros)[]).map((key) => (
          <NumberField
            key={key}
            label={MACRO_LABELS[key]}
            value={item[key]}
            suffix={key === "calories" ? "kcal" : "g"}
            blankZero={key !== "calories"}
            required={key === "calories"}
            onChange={(value) => {
              const next = { ...item, [key]: value };
              if (key !== "calories") next.calories = macroEnergy(next);
              onChange(next);
            }}
          />
        ))}
      </div>
      <p className="field-hint">
        Ao alterar os macros, as calorias são calculadas automaticamente:
        proteína e carboidrato têm 4 kcal/g; gordura tem 9 kcal/g.
      </p>
    </div>
  );
}
export function MealEditor({
  meal,
  date,
  initialType,
  initialMode = "quick",
  onClose,
}: {
  meal?: Meal;
  date: string;
  initialType: string;
  initialMode?: "quick" | "photo";
  onClose: () => void;
}) {
  const data = useData();
  const { update, notify } = useApp();
  const draftKey = meal?.id ?? "new";
  const [restored] = useState(data.mealDrafts?.[draftKey]);
  const [id] = useState(restored?.meal.id ?? meal?.id ?? uid());
  const [type, setType] = useState(
    restored?.meal.type ?? meal?.type ?? initialType,
  );
  const [day, setDay] = useState(restored?.meal.date ?? meal?.date ?? date);
  const [time, setTime] = useState(
    restored?.meal.time ?? meal?.time ?? new Date().toTimeString().slice(0, 5),
  );
  const [items, setItems] = useState<FoodItem[]>(
    structuredClone(restored?.meal.items ?? meal?.items ?? []),
  );
  const [mode, setMode] = useState<"manual" | "photo" | "quick">(
    restored?.mode ?? (meal ? "manual" : initialMode),
  );
  const [photo, setPhoto] = useState(restored?.photo ?? "");
  const [analyzed, setAnalyzed] = useState(restored?.analyzed ?? false);
  const [analysisNote, setAnalysisNote] = useState(
    restored?.analysisNote ?? "",
  );
  const analysisAbort = useRef<AbortController | null>(null);
  const [saveTemplate, setSaveTemplate] = useState(
    restored?.saveTemplate ?? false,
  );
  const [templateName, setTemplateName] = useState(
    restored?.templateName ?? "",
  );
  const [draftError, setDraftError] = useState("");
  const task = useFormTask();
  const aiTask = useFormTask();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const analysisRequest = useRef(0);
  useEffect(
    () => () => {
      analysisRequest.current += 1;
      analysisAbort.current?.abort();
    },
    [],
  );
  const updateRef = useRef(update);
  updateRef.current = update;
  const snapshot: MealDraft = {
    meal: { id, date: day, time, type, items },
    originalId: meal?.id,
    mode,
    photo,
    analyzed,
    analysisNote,
    saveTemplate,
    templateName,
  };
  const signature = JSON.stringify(snapshot);
  const savedSignature = useRef(signature);
  const pendingDraft = useRef(Promise.resolve());
  const persistDraft = async () => {
    if (done.current || signature === savedSignature.current) return;
    await updateRef.current((d) => ({
      ...d,
      mealDrafts: { ...d.mealDrafts, [draftKey]: snapshot },
    }));
    savedSignature.current = signature;
    setDraftError("");
  };
  useEffect(() => {
    if (done.current || signature === savedSignature.current) return;
    pendingDraft.current = persistDraft().catch((e) =>
      setDraftError((e as Error).message),
    );
  }, [signature]);
  const close = () =>
    void task.run(async () => {
      await pendingDraft.current;
      await persistDraft();
      analysisRequest.current += 1;
      analysisAbort.current?.abort();
      onClose();
    });
  const discardDraft = () =>
    void task.run(async () => {
      if (
        !window.confirm(
          "Descartar alterações desta refeição? O registro já salvo será preservado.",
        )
      )
        return;
      await pendingDraft.current;
      await update((d) => {
        const drafts = { ...d.mealDrafts };
        delete drafts[draftKey];
        return { ...d, mealDrafts: drafts };
      });
      done.current = true;
      analysisRequest.current += 1;
      analysisAbort.current?.abort();
      onClose();
    });
  const pick = async (file?: File) => {
    if (!file) return;
    await aiTask.run(async () => {
      const request = ++analysisRequest.current;
      const compressed = await compressPhoto(file);
      if (request !== analysisRequest.current) return;
      setPhoto(compressed);
      setAnalyzed(false);
      setAnalysisNote("");
    });
  };
  const analyze = () =>
    aiTask.run(async () => {
      const request = ++analysisRequest.current;
      analysisAbort.current?.abort();
      const controller = new AbortController();
      analysisAbort.current = controller;
      try {
        const result = await nutritionAI.analyze(photo, controller.signal);
        if (request !== analysisRequest.current) return;
        setItems((current) => [...current, ...result.items]);
        setAnalysisNote(result.note);
        setAnalyzed(true);
      } catch (error) {
        if (request === analysisRequest.current && !controller.signal.aborted)
          throw error;
      }
    });
  const save = () =>
    task.run(async () => {
      if (!items.length)
        throw new Error("Adicione pelo menos um alimento antes de salvar.");
      if (
        items.some(
          (i) =>
            !i.name.trim() ||
            !Number.isFinite(i.portion) ||
            i.portion <= 0 ||
            Object.values({
              calories: i.calories,
              protein: i.protein,
              carbs: i.carbs,
              fat: i.fat,
            }).some((v) => !Number.isFinite(v) || v < 0),
        )
      )
        throw new Error("Confira as porções e os nutrientes dos alimentos.");
      const next: Meal = {
        id,
        date: day,
        time,
        type,
        items,
      };
      if (saveTemplate && !templateName.trim())
        throw new Error("Dê um nome para salvar em Minhas refeições.");
      await pendingDraft.current;
      await update((d) => {
        const result = saveMealData(d, next, draftKey);
        if (saveTemplate)
          result.savedMeals = [
            ...(d.savedMeals ?? []),
            { id: uid(), name: templateName.trim(), items: cloneFoods(items) },
          ];
        return result;
      });
      done.current = true;
      notify(meal ? "Refeição atualizada." : "Mais uma escolha registrada!");
      onClose();
    });
  return (
    <Modal
      title={meal ? "Editar refeição" : "Registrar refeição"}
      subtitle="O que fez parte do seu dia?"
      onClose={close}
      wide
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="draft-note">
          {restored ? "Rascunho recuperado. " : ""}Alterações ficam em rascunho
          até salvar a refeição.
        </p>
        <ErrorBox message={draftError} />
        <div className="form-grid three">
          <Field label="Refeição">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {MEAL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Data">
            <DateInput
              value={day}
              required
              max={today()}
              onValueChange={(value) => setDay(value)}
            />
          </Field>
          <Field label="Horário">
            <input
              type="time"
              value={time}
              required
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        </div>
        <Segmented
          label="Como adicionar alimentos"
          value={mode}
          onChange={setMode}
          options={[
            { value: "quick", label: "Recentes e salvos" },
            { value: "photo", label: "Por foto" },
            { value: "manual", label: "Manualmente" },
          ]}
        />
        {mode === "quick" && (
          <FoodLibrary
            onAdd={(added, mealType) => {
              setItems([...items, ...added]);
              if (!items.length && mealType) setType(mealType);
            }}
          />
        )}
        {mode === "photo" && (
          <>
            <input
              ref={fileRef}
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Selecionar foto da refeição"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              className="visually-hidden"
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Tirar foto da refeição"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {!photo ? (
              <div className="upload-zone">
                <div className="upload-icon">
                  <Camera size={30} />
                </div>
                <h3>Seu prato tem uma história.</h3>
                <p>Envie uma foto e revise os alimentos antes de salvar.</p>
                <div className="button-row">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileRef.current?.click()}
                    loading={aiTask.busy}
                  >
                    <Upload size={16} />
                    Escolher foto
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => cameraRef.current?.click()}
                  >
                    <Camera size={16} />
                    Usar câmera
                  </Button>
                </div>
                <small>JPG, PNG ou WebP · Até 15 MB</small>
              </div>
            ) : (
              <div className="photo-analysis">
                <img src={photo} alt="Foto da refeição selecionada" />
                <div>
                  <span className="pill">
                    <Sparkles size={13} />
                    ESTIMATIVA POR FOTO
                  </span>
                  <h3>
                    {analyzed
                      ? "Pronto para sua revisão"
                      : aiTask.busy
                        ? "Preparando sua estimativa…"
                        : "Vamos conhecer esse prato?"}
                  </h3>
                  <p>
                    {analyzed
                      ? "Revise nomes, porções e macros abaixo. Os itens só serão registrados ao salvar."
                      : "A foto pode ser salva com o rascunho na sua conta."}
                  </p>
                  <div className="button-row">
                    <Button
                      type="button"
                      loading={aiTask.busy}
                      disabled={analyzed || !photo}
                      onClick={() => void analyze()}
                    >
                      <Sparkles size={16} />
                      {analyzed ? "Itens adicionados" : "Analisar foto"}
                    </Button>
                    <IconButton
                      type="button"
                      label="Remover foto"
                      onClick={() => {
                        analysisRequest.current += 1;
                        analysisAbort.current?.abort();
                        setAnalysisNote("");
                        setPhoto("");
                        setAnalyzed(false);
                        setItems(
                          items.map((i) => ({ ...i, photo: undefined })),
                        );
                      }}
                    >
                      <X size={18} />
                    </IconButton>
                  </div>
                </div>
              </div>
            )}
            <p className="simulation-note">
              <Sparkles size={13} /> Ao analisar, a foto será enviada à OpenAI.
              As porções e os nutrientes são estimativas: revise antes de
              salvar.
            </p>
            {analysisNote && (
              <p className="info-box" role="status">
                {analysisNote}
              </p>
            )}
            <ErrorBox message={aiTask.error} />
          </>
        )}
        {items.length > 0 && (
          <SectionHeading
            title={analyzed ? "Revise os alimentos" : "Alimentos da refeição"}
            count={items.length}
          />
        )}
        {items.map((item, index) => (
          <ItemEditor
            key={item.id}
            item={item}
            index={index}
            onChange={(next) =>
              setItems(items.map((i) => (i.id === next.id ? next : i)))
            }
            onRemove={() => setItems(items.filter((i) => i.id !== item.id))}
          />
        ))}
        <Button
          type="button"
          variant="secondary"
          className="add-item-button"
          onClick={() => setItems([...items, food("", 0, 0, 0, 0)])}
        >
          <Plus size={16} />
          Adicionar alimento manualmente
        </Button>
        {items.length > 0 && (
          <div className="meal-total">
            <div>
              <span>Total da refeição</span>
              <strong>
                {fmt(sumMacros(items).calories)} <small>kcal</small>
              </strong>
            </div>
            <MacroChips macros={sumMacros(items)} />
          </div>
        )}
        <ErrorBox message={task.error} />
        {items.length > 0 && (
          <div className="save-meal-template">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={saveTemplate}
                onChange={(e) => setSaveTemplate(e.target.checked)}
              />
              Salvar também em Minhas refeições
            </label>
            {saveTemplate && (
              <Field label="Nome da refeição salva">
                <input
                  required
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ex.: Meu café da manhã"
                  maxLength={80}
                />
              </Field>
            )}
          </div>
        )}
        {task.error && items.some((i) => i.photo) && (
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setItems(items.map((i) => ({ ...i, photo: undefined })));
              setPhoto("");
            }}
          >
            Remover fotos para tentar salvar novamente
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={discardDraft}
          disabled={task.busy}
        >
          Descartar rascunho
        </Button>
        <div className="form-actions sticky-form-actions">
          <Button type="button" variant="ghost" onClick={close}>
            Fechar e continuar depois
          </Button>
          <SaveButton busy={task.busy || aiTask.busy}>
            {meal ? "Salvar alterações" : "Salvar refeição"}
          </SaveButton>
        </div>
      </form>
    </Modal>
  );
}
