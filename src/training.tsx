import { DateInput } from "./date-input";
import { useEffect, useRef, useState } from "react";
import "./training-ux.css";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Dumbbell,
  History,
  ListChecks,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useApp, useData } from "./store";
import {
  dateLabel,
  fmt,
  prescription,
  startSession,
  today,
  uid,
  volume,
  weightDisplay,
  weightInternal,
  weightUnit,
} from "./domain";
import type {
  Plan,
  PlanDay,
  Prescription,
  Session,
  SessionExercise,
} from "./domain";
import { trainingAI } from "./services";
import { TrainingFields } from "./profile";
import {
  Button,
  ContextActions,
  Empty,
  ErrorBox,
  Field,
  IconButton,
  Modal,
  NumberField,
  PageTitle,
  SaveButton,
  Segmented,
  useFormTask,
} from "./ui";

export function WorkoutPage() {
  const data = useData();
  const { update, notify } = useApp();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"plans" | "history">(
    params.get("tab") === "history" ? "history" : "plans",
  );
  const [retroSession, setRetroSession] = useState<Session | null>(null);
  const [editor, setEditor] = useState<Plan | "new" | null>(null);
  const [generator, setGenerator] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(
    params.get("session"),
  );
  const [expanded, setExpanded] = useState(
    params.get("plan") ?? data.plans.find((p) => p.active)?.id ?? "",
  );
  useEffect(() => {
    if (params.has("plan")) setExpanded(params.get("plan")!);
    if (params.has("session")) setSessionId(params.get("session"));
    if (params.get("tab") === "history") setTab("history");
  }, [params]);
  const task = useFormTask();
  const running = data.sessions.find((s) => !s.finishedAt);
  const history = [...data.sessions]
    .filter((s) => s.finishedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
  const selectedSession =
    retroSession ?? data.sessions.find((s) => s.id === sessionId);
  const begin = (day: PlanDay, planId?: string, retro = false) =>
    task.run(async () => {
      if (running && !retro) {
        setSessionId(running.id);
        return;
      }
      const s = startSession(day, planId);
      if (retro) {
        s.finishedAt = new Date().toISOString();
        s.duration = 2700;
        s.exercises.forEach((e) => e.sets.forEach((set) => (set.done = true)));
        setRetroSession(s);
        return;
      }
      await update((d) => ({ ...d, sessions: [...d.sessions, s] }));
      setSessionId(s.id);
    });
  const activePlan = data.plans.find((p) => p.active);
  const openPlan = (plan: Plan | "new") => {
    if (
      data.planDraft &&
      (plan === "new" || plan.id !== data.planDraft.plan.id)
    ) {
      notify("Continue ou descarte o rascunho antes de abrir outro plano.");
      setEditor(data.planDraft.plan);
      return;
    }
    setEditor(data.planDraft?.plan ?? plan);
  };
  const setActive = (plan: Plan) =>
    task.run(async () => {
      await update((d) => ({
        ...d,
        plans: d.plans.map((p) => ({ ...p, active: p.id === plan.id })),
      }));
      notify("Plano ativo atualizado.");
    });
  const duplicate = (plan: Plan) =>
    task.run(async () => {
      const clone: Plan = {
        ...structuredClone(plan),
        id: uid(),
        name: plan.name + " · Cópia",
        active: false,
        updatedAt: new Date().toISOString(),
        revisions: [],
      };
      await update((d) => ({ ...d, plans: [...d.plans, clone] }));
      setExpanded(clone.id);
      notify("Plano duplicado.");
    });
  const remove = (plan: Plan) => {
    if (
      !window.confirm(
        "Excluir o plano? Os treinos já realizados serão preservados.",
      )
    )
      return;
    void task.run(async () => {
      await update((d) => ({
        ...d,
        plans: d.plans.filter((p) => p.id !== plan.id),
      }));
      notify("Plano excluído.");
    });
  };
  return (
    <>
      <PageTitle
        title="Treinos"
        action={
          <div className="button-row">
            <Button
              variant="secondary"
              onClick={() =>
                data.planDraft ? openPlan("new") : setGenerator(true)
              }
            >
              <Sparkles size={17} />
              Gerar com IA
            </Button>
            <Button onClick={() => openPlan("new")}>
              <Plus size={17} />
              Criar plano
            </Button>
          </div>
        }
      />
      <div className="training-summary" aria-label="Resumo dos treinos">
        <span>
          <strong>{history.length}</strong> concluídos
        </span>
        <span>
          <strong>{data.profile.frequency || "—"}</strong> / semana
        </span>
        <span>
          <strong>{data.plans.length}</strong> planos
        </span>
      </div>
      {running && (
        <div className="running-banner">
          <div className="running-icon">
            <Play size={20} />
          </div>
          <div>
            <strong>Seu treino está em andamento</strong>
            <p>
              {running.name} ·{" "}
              {
                running.exercises.flatMap((e) => e.sets).filter((s) => s.done)
                  .length
              }{" "}
              séries concluídas
            </p>
          </div>
          <Button onClick={() => setSessionId(running.id)}>
            Retomar treino
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
      {data.planDraft && (
        <section
          className="card plan-draft-banner"
          aria-label="Rascunho de plano"
        >
          <div>
            <strong>Seu plano ficou salvo como rascunho</strong>
            <p>
              {data.planDraft.plan.name || "Plano sem nome"} · Ainda não altera
              sua prescrição.
            </p>
          </div>
          <div className="button-row">
            <Button onClick={() => setEditor(data.planDraft!.plan)}>
              Continuar rascunho
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm("Descartar o rascunho do plano?"))
                  void task.run(async () => {
                    await update((d) => ({ ...d, planDraft: undefined }));
                    notify("Rascunho descartado.");
                  });
              }}
            >
              Descartar rascunho
            </Button>
          </div>
        </section>
      )}
      <div className="section-toolbar">
        <Segmented
          label="Visão de treinos"
          value={tab}
          onChange={setTab}
          options={[
            { value: "plans", label: "Meus planos" },
            { value: "history", label: "Histórico de treinos" },
          ]}
        />
        {tab === "history" && (
          <Button
            variant="secondary"
            onClick={() =>
              void begin(
                activePlan?.days[0] ?? {
                  id: uid(),
                  name: "Treino avulso",
                  exercises: [
                    {
                      ...prescription(0),
                      exerciseId: "custom-" + uid(),
                      name: "",
                    },
                  ],
                },
                activePlan?.id,
                true,
              )
            }
          >
            <Plus size={16} />
            Registrar treino anterior
          </Button>
        )}
      </div>
      <ErrorBox message={task.error} />
      {tab === "plans" ? (
        <div className="plans-list">
          {!data.plans.length && (
            <Empty
              icon={<Dumbbell />}
              title="Seu primeiro plano começa aqui"
              description="Monte sua rotina ou explore uma proposta gerada com IA."
              action={
                <Button onClick={() => openPlan("new")}>
                  Criar meu primeiro plano
                </Button>
              }
            />
          )}
          {data.plans.map((plan) => (
            <section
              className={"card plan-card " + (plan.active ? "plan-active" : "")}
              key={plan.id}
            >
              <div className="plan-header">
                <button
                  className="plan-expand"
                  onClick={() =>
                    setExpanded(expanded === plan.id ? "" : plan.id)
                  }
                >
                  <div className="plan-icon">
                    <Dumbbell size={24} />
                  </div>
                  <div>
                    {plan.active && (
                      <span className="eyebrow">SEU PLANO ATIVO</span>
                    )}
                    <h2>{plan.name}</h2>
                    <p>
                      {plan.description ||
                        plan.days.length + " sessões de treino"}
                    </p>
                  </div>
                  <ChevronDown
                    size={19}
                    className={expanded === plan.id ? "rotated" : ""}
                  />
                </button>
                <div className="plan-actions">
                  <IconButton
                    label={"Editar " + plan.name}
                    onClick={() => openPlan(plan)}
                  >
                    <Pencil size={17} />
                  </IconButton>
                  <ContextActions label={"Mais opções de " + plan.name}>
                    {!plan.active && (
                      <Button
                        variant="ghost"
                        onClick={() => void setActive(plan)}
                      >
                        Ativar plano
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      aria-label={"Duplicar " + plan.name}
                      onClick={() => void duplicate(plan)}
                    >
                      <Copy size={16} />
                      Duplicar plano
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={"Excluir " + plan.name}
                      onClick={() => remove(plan)}
                    >
                      <Trash2 size={16} />
                      Excluir plano
                    </Button>
                  </ContextActions>
                </div>
              </div>
              {expanded === plan.id && (
                <div className="plan-days">
                  {plan.days.map((day, i) => (
                    <div className="plan-day" key={day.id}>
                      <div className="plan-day-heading">
                        <span className="day-letter">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <div>
                          <h3>{day.name}</h3>
                          <span>
                            {day.exercises.length} exercícios ·{" "}
                            {day.exercises.reduce((s, e) => s + e.sets, 0)}{" "}
                            séries
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => void begin(day, plan.id)}
                        >
                          <Play size={15} />
                          {running ? "Retomar" : "Iniciar treino"}
                        </Button>
                      </div>
                      <div className="exercise-preview">
                        {day.exercises.map((e) => (
                          <div key={e.id}>
                            <span className="exercise-symbol">
                              <Dumbbell size={15} />
                            </span>
                            <span>{e.name}</span>
                            <small>
                              {e.sets} × {e.reps}
                            </small>
                            <b>
                              {e.weight
                                ? fmt(
                                    weightDisplay(e.weight, data.profile.units),
                                    1,
                                  ) +
                                  " " +
                                  weightUnit(data.profile)
                                : "Livre"}
                            </b>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="plan-footer">
                    <Clock3 size={14} />
                    <span>
                      Atualizado em{" "}
                      {new Date(plan.updatedAt).toLocaleString("pt-BR")}
                    </span>
                    {plan.revisions.length > 0 && (
                      <details>
                        <summary>
                          {plan.revisions.length} alterações anteriores
                        </summary>
                        {plan.revisions
                          .slice()
                          .reverse()
                          .map((r, i) => (
                            <div key={i}>
                              <strong>
                                {new Date(r.at).toLocaleString("pt-BR")}
                              </strong>
                              {r.days.map((d) => (
                                <p key={d.id}>
                                  {d.name}:{" "}
                                  {d.exercises
                                    .map(
                                      (e) =>
                                        e.name +
                                        " " +
                                        e.sets +
                                        "×" +
                                        e.reps +
                                        " · " +
                                        fmt(
                                          weightDisplay(
                                            e.weight,
                                            data.profile.units,
                                          ),
                                          1,
                                        ) +
                                        " " +
                                        weightUnit(data.profile),
                                    )
                                    .join("; ")}
                                </p>
                              ))}
                            </div>
                          ))}
                      </details>
                    )}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="history-list">
          {!history.length ? (
            <Empty
              icon={<History />}
              title="Sua história de treino começa aqui"
              description="Conclua uma sessão ou registre um treino anterior."
            />
          ) : (
            history.map((s) => (
              <button
                key={s.id}
                className="card history-row"
                onClick={() => setSessionId(s.id)}
              >
                <span className="history-date">
                  <strong>{dateLabel(s.date, { day: "numeric" })}</strong>
                  <small>{dateLabel(s.date, { month: "short" })}</small>
                </span>
                <span className="history-info">
                  <strong>{s.name}</strong>
                  <small>
                    {s.exercises.length} exercícios ·{" "}
                    {
                      s.exercises.flatMap((e) => e.sets).filter((s) => s.done)
                        .length
                    }{" "}
                    séries · {Math.round(s.duration / 60)} min
                  </small>
                </span>
                <span className="history-volume">
                  {fmt(weightDisplay(volume(s), data.profile.units))}
                  <small>{weightUnit(data.profile)} de volume</small>
                </span>
                <ChevronRight size={19} />
              </button>
            ))
          )}
        </div>
      )}
      {editor && (
        <PlanEditor
          plan={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {generator && (
        <PlanGenerator
          onClose={() => setGenerator(false)}
          onGenerated={(p) => {
            setGenerator(false);
            setEditor(p);
          }}
        />
      )}
      {selectedSession && (
        <SessionEditor
          session={selectedSession}
          onClose={() => {
            setSessionId(null);
            setRetroSession(null);
          }}
        />
      )}
    </>
  );
}
function ExerciseName({
  value,
  onChange,
}: {
  value: Prescription;
  onChange: (v: Prescription) => void;
}) {
  return (
    <Field label="Nome do exercício">
      <input
        required
        value={value.name}
        placeholder="Nome do exercício"
        onChange={(e) =>
          onChange({
            ...value,
            name: e.target.value,
            exerciseId:
              "custom-" + e.target.value.trim().toLocaleLowerCase("pt-BR"),
          })
        }
      />
    </Field>
  );
}

function PlanEditor({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const data = useData();
  const { update, notify } = useApp();
  const [draft, setDraftState] = useState<Plan>(
    plan
      ? structuredClone(plan)
      : {
          id: uid(),
          name: "",
          description: "",
          active: !data.plans.length,
          updatedAt: new Date().toISOString(),
          revisions: [],
          days: [
            {
              id: uid(),
              name: "Treino A",
              exercises: [
                { ...prescription(0), exerciseId: "custom-" + uid(), name: "" },
              ],
            },
          ],
        },
  );
  const task = useFormTask();
  const [draftError, setDraftError] = useState("");
  const persistDraft = (next: Plan) => {
    void update((d) => ({
      ...d,
      planDraft: {
        plan: next,
        originalId: d.plans.some((p) => p.id === next.id) ? next.id : undefined,
      },
    }))
      .then(() => setDraftError(""))
      .catch((e) => setDraftError((e as Error).message));
  };
  const setDraft = (next: Plan) => {
    setDraftState(next);
    persistDraft(next);
  };
  useEffect(() => {
    persistDraft(draft);
  }, []);
  const changeDay = (id: string, values: Partial<PlanDay>) =>
    setDraft({
      ...draft,
      days: draft.days.map((d) => (d.id === id ? { ...d, ...values } : d)),
    });
  const save = () =>
    task.run(async () => {
      if (!draft.days.length || draft.days.some((d) => !d.exercises.length))
        throw new Error(
          "Adicione pelo menos uma sessão e um exercício em cada sessão.",
        );
      const existing = data.plans.find((p) => p.id === draft.id);
      const now = new Date().toISOString();
      const next = {
        ...draft,
        updatedAt: now,
        revisions: existing
          ? [
              ...existing.revisions,
              { at: existing.updatedAt, days: structuredClone(existing.days) },
            ]
          : [],
      };
      await update((d) => ({
        ...d,
        planDraft: undefined,
        plans: [
          ...d.plans
            .filter((p) => p.id !== next.id)
            .map((p) => (next.active ? { ...p, active: false } : p)),
          next,
        ],
      }));
      notify("Plano salvo. Seu próximo passo está pronto.");
      onClose();
    });
  return (
    <Modal
      title={
        data.plans.some((p) => p.id === draft.id)
          ? "Editar plano"
          : "Seu novo plano"
      }
      subtitle="Prescrição do plano · O rascunho fica salvo ao fechar. Só Salvar plano aplica as alterações."
      onClose={onClose}
      wide
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Nome do plano">
          <input
            value={draft.name}
            required
            maxLength={80}
            placeholder="Ex.: Minha rotina de força"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Descrição">
          <textarea
            value={draft.description}
            maxLength={1200}
            rows={3}
            placeholder="Ex.: Divisão ABC · Foco em força"
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
        </Field>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Usar como meu plano ativo
        </label>
        {draft.days.map((day, index) => (
          <section className="plan-day-editor" key={day.id}>
            <div className="subheading">
              <h3>Sessão {String.fromCharCode(65 + index)}</h3>
              <IconButton
                type="button"
                label="Remover sessão"
                onClick={() =>
                  setDraft({
                    ...draft,
                    days: draft.days.filter((d) => d.id !== day.id),
                  })
                }
              >
                <Trash2 size={17} />
              </IconButton>
            </div>
            <Field label="Nome da sessão">
              <input
                value={day.name}
                required
                onChange={(e) => changeDay(day.id, { name: e.target.value })}
              />
            </Field>
            {day.exercises.map((ex, i) => (
              <div className="prescription-editor" key={ex.id}>
                <div className="item-editor-heading">
                  <span className="item-number">{i + 1}</span>
                  <strong>Exercício</strong>
                  <IconButton
                    type="button"
                    label={"Remover " + ex.name}
                    onClick={() =>
                      changeDay(day.id, {
                        exercises: day.exercises.filter((e) => e.id !== ex.id),
                      })
                    }
                  >
                    <X size={16} />
                  </IconButton>
                </div>
                <ExerciseName
                  value={ex}
                  onChange={(next) =>
                    changeDay(day.id, {
                      exercises: day.exercises.map((e) =>
                        e.id === ex.id ? next : e,
                      ),
                    })
                  }
                />
                <div className="macro-inputs">
                  <NumberField
                    label="Séries"
                    value={ex.sets}
                    min={1}
                    max={20}
                    step={1}
                    onChange={(sets) =>
                      changeDay(day.id, {
                        exercises: day.exercises.map((e) =>
                          e.id === ex.id ? { ...e, sets } : e,
                        ),
                      })
                    }
                  />
                  <NumberField
                    label="Repetições"
                    value={ex.reps}
                    min={1}
                    max={200}
                    step={1}
                    onChange={(reps) =>
                      changeDay(day.id, {
                        exercises: day.exercises.map((e) =>
                          e.id === ex.id ? { ...e, reps } : e,
                        ),
                      })
                    }
                  />
                  <NumberField
                    label={"Carga (" + weightUnit(data.profile) + ")"}
                    value={weightDisplay(ex.weight, data.profile.units)}
                    onChange={(v) =>
                      changeDay(day.id, {
                        exercises: day.exercises.map((e) =>
                          e.id === ex.id
                            ? {
                                ...e,
                                weight: weightInternal(v, data.profile.units),
                              }
                            : e,
                        ),
                      })
                    }
                  />
                  <NumberField
                    label="Descanso (s)"
                    value={ex.rest}
                    min={0}
                    max={900}
                    step={1}
                    onChange={(rest) =>
                      changeDay(day.id, {
                        exercises: day.exercises.map((e) =>
                          e.id === ex.id ? { ...e, rest } : e,
                        ),
                      })
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                changeDay(day.id, {
                  exercises: [
                    ...day.exercises,
                    {
                      ...prescription(0),
                      exerciseId: "custom-" + uid(),
                      name: "",
                    },
                  ],
                })
              }
            >
              <Plus size={16} />
              Adicionar exercício
            </Button>
          </section>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setDraft({
              ...draft,
              days: [
                ...draft.days,
                {
                  id: uid(),
                  name: "Treino " + String.fromCharCode(65 + draft.days.length),
                  exercises: [
                    {
                      ...prescription(0),
                      exerciseId: "custom-" + uid(),
                      name: "",
                    },
                  ],
                },
              ],
            })
          }
        >
          <Plus size={16} />
          Adicionar sessão ao plano
        </Button>
        <ErrorBox message={task.error || draftError} />
        {draftError && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => persistDraft(draft)}
          >
            Tentar salvar rascunho
          </Button>
        )}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar e continuar depois
          </Button>
          <SaveButton busy={task.busy}>Salvar plano</SaveButton>
        </div>
      </form>
    </Modal>
  );
}
function PlanGenerator({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (plan: Plan) => void;
}) {
  const data = useData();
  const [profile, setProfile] = useState({ ...data.profile });
  const task = useFormTask();
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  return (
    <Modal
      title="Um plano para o seu momento"
      subtitle="Conte sua rotina. Você revisa tudo antes de salvar."
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            if (profile.frequency < 1 || profile.minutes < 1)
              throw new Error(
                "Informe a frequência e o tempo disponíveis para começar a treinar.",
              );
            const controller = new AbortController();
            abort.current = controller;
            try {
              const plan = await trainingAI.generate(
                profile,
                controller.signal,
              );
              if (!controller.signal.aborted) onGenerated(plan);
            } catch (error) {
              if (!controller.signal.aborted) throw error;
            }
          });
        }}
      >
        <fieldset
          disabled={task.busy}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          className="form-stack"
        >
          <div className="ai-generator-hero">
            <Sparkles size={32} />
            <h3>O primeiro passo fica mais fácil.</h3>
            <p>
              Uma proposta de treino que considera seu tempo e sua experiência.
            </p>
          </div>
          <div className="form-grid">
            <NumberField
              label="Idade"
              value={profile.age}
              min={18}
              max={120}
              step={1}
              onChange={(age) => setProfile({ ...profile, age })}
            />
            <Field label="Objetivo">
              <select
                value={profile.goal}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    goal: e.target.value as typeof profile.goal,
                  })
                }
              >
                <option value="cutting">Emagrecer</option>
                <option value="maintenance">Manter o peso</option>
                <option value="bulking">Ganhar massa</option>
              </select>
            </Field>
          </div>
          <TrainingFields
            allowNoTraining={false}
            profile={profile}
            onChange={setProfile}
          />
        </fieldset>
        <div className="info-box">
          <Sparkles size={18} />
          <span>
            A IA escolhe os exercícios para uma academia convencional. Sua
            idade, objetivo e rotina serão enviados à OpenAI. Revise os
            exercícios e ajuste as cargas antes de usar; a proposta não avalia
            lesões ou limitações individuais.
          </span>
        </div>
        <ErrorBox message={task.error} />
        <Button type="submit" loading={task.busy}>
          <Sparkles size={17} />
          {task.busy ? "Preparando seu plano…" : "Gerar proposta de treino"}
        </Button>
      </form>
    </Modal>
  );
}
function SessionEditor({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) {
  const data = useData();
  const { update, notify } = useApp();
  const [draft, setDraft] = useState<Session>(structuredClone(session));
  const task = useFormTask();
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const currentExercise = draft.exercises.find((ex) =>
    ex.sets.some((set) => !set.done),
  );
  const currentSetIndex =
    currentExercise?.sets.findIndex((set) => !set.done) ?? -1;
  const currentSet = currentExercise?.sets[currentSetIndex];
  const allSets = draft.exercises.flatMap((ex) => ex.sets);
  const completedCount = allSets.filter((set) => set.done).length;
  const [saveError, setSaveError] = useState("");
  const [summary, setSummary] = useState<Session | null>(null);
  const timerKey = "asimov-fit:rest:" + data.profile.email + ":" + session.id;
  const [end, setEnd] = useState(() => {
    try {
      return Number(sessionStorage.getItem(timerKey)) || 0;
    } catch {
      return 0;
    }
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const restLeft = Math.max(0, Math.ceil((end - now) / 1000));
  const elapsed = draft.finishedAt
    ? draft.duration
    : Math.max(
        0,
        Math.floor((now - new Date(draft.startedAt).getTime()) / 1000),
      );
  const startRest = (seconds: number) => {
    const next = Date.now() + seconds * 1000;
    setEnd(next);
    setNow(Date.now());
    try {
      sessionStorage.setItem(timerKey, String(next));
    } catch {
      /* Timer still works in memory. */
    }
  };
  const persist = (next: Session) => {
    setDraft(next);
    if (next.finishedAt) return;
    void update((d) => ({
      ...d,
      sessions: d.sessions.map((s) => (s.id === next.id ? next : s)),
    }))
      .then(() => setSaveError(""))
      .catch((e) => setSaveError((e as Error).message));
  };
  const setExercises = (exercises: SessionExercise[]) =>
    persist({ ...draft, exercises });
  const completeCurrent = () => {
    if (!currentExercise || !currentSet) return;
    setExercises(
      draft.exercises.map((ex) =>
        ex.id === currentExercise.id
          ? {
              ...ex,
              sets: ex.sets.map((set) =>
                set.id === currentSet.id ? { ...set, done: true } : set,
              ),
            }
          : ex,
      ),
    );
    setOpened((previous) => ({ ...previous, [currentExercise.id]: false }));
    startRest(currentExercise.rest);
  };
  const repeatPrevious = () => {
    if (!currentExercise || !currentSet || currentSetIndex < 1) return;
    const previous = currentExercise.sets[currentSetIndex - 1];
    setExercises(
      draft.exercises.map((ex) =>
        ex.id === currentExercise.id
          ? {
              ...ex,
              sets: ex.sets.map((set) =>
                set.id === currentSet.id
                  ? { ...set, weight: previous.weight, reps: previous.reps }
                  : set,
              ),
            }
          : ex,
      ),
    );
    notify("Carga e repetições copiadas para a série atual.");
  };
  const finish = () =>
    task.run(async () => {
      if (!draft.exercises.some((e) => e.sets.some((s) => s.done)))
        throw new Error("Marque pelo menos uma série como concluída.");
      const next = {
        ...draft,
        finishedAt: draft.finishedAt ?? new Date().toISOString(),
        duration: elapsed,
      };
      await update((d) => ({
        ...d,
        sessions: [...d.sessions.filter((s) => s.id !== next.id), next],
      }));
      startRest(0);
      setSummary(next);
      notify(
        session.finishedAt
          ? "Treino atualizado."
          : "Treino concluído. Mais um passo dado!",
      );
    });
  const discard = () => {
    if (
      window.confirm(
        "Excluir esta sessão? Essa ação remove as séries registradas.",
      )
    )
      void task.run(async () => {
        await update((d) => ({
          ...d,
          sessions: d.sessions.filter((s) => s.id !== draft.id),
        }));
        notify("Sessão excluída.");
        onClose();
      });
  };
  if (summary)
    return (
      <Modal title="Mais forte que ontem." onClose={onClose}>
        <div className="workout-summary">
          <span className="trophy-icon">
            <Trophy size={45} />
          </span>
          <span className="eyebrow">MAIS UMA CONQUISTA SUA</span>
          <h2>Treino registrado!</h2>
          <p>{summary.name}</p>
          <div className="summary-stats">
            <div>
              <strong>{Math.round(summary.duration / 60)}</strong>
              <span>minutos</span>
            </div>
            <div>
              <strong>
                {
                  summary.exercises.flatMap((e) => e.sets).filter((s) => s.done)
                    .length
                }
              </strong>
              <span>séries</span>
            </div>
            <div>
              <strong>
                {fmt(weightDisplay(volume(summary), data.profile.units))}
              </strong>
              <span>{weightUnit(data.profile)} de volume</span>
            </div>
          </div>
          <Button onClick={onClose}>
            Continuar minha jornada
            <ArrowRight size={17} />
          </Button>
        </div>
      </Modal>
    );
  return (
    <Modal
      title={draft.name}
      subtitle={
        draft.finishedAt
          ? "Histórico · Revise o treino realizado. A prescrição do plano permanece preservada."
          : "Treino em andamento · Suas séries são salvas conforme você registra."
      }
      onClose={onClose}
      wide
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void finish();
        }}
      >
        <div className="session-timer">
          <span>
            <Timer size={20} />
            {Math.floor(elapsed / 60)
              .toString()
              .padStart(2, "0")}
            :{(elapsed % 60).toString().padStart(2, "0")}
            <small>tempo de treino</small>
          </span>
          <span>
            <ListChecks size={18} />
            {
              draft.exercises.flatMap((e) => e.sets).filter((s) => s.done)
                .length
            }
            /{draft.exercises.flatMap((e) => e.sets).length}
            <small>séries</small>
          </span>
        </div>
        {!draft.finishedAt && (
          <section className="workout-focus" aria-label="Série atual">
            <div className="focus-heading">
              <span className="eyebrow">
                {currentSet ? "AGORA NO SEU TREINO" : "SÉRIES CONCLUÍDAS"}
              </span>
              <strong>
                {completedCount}/{allSets.length} séries
              </strong>
            </div>
            <progress
              aria-label="Progresso do treino"
              max={Math.max(1, allSets.length)}
              value={completedCount}
            />
            {currentExercise && currentSet ? (
              <>
                <h3>{currentExercise.name}</h3>
                <p>
                  Série {currentSetIndex + 1} de {currentExercise.sets.length} ·{" "}
                  {fmt(weightDisplay(currentSet.weight, data.profile.units), 1)}{" "}
                  {weightUnit(data.profile)} × {currentSet.reps} repetições
                </p>
                {currentSetIndex > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={repeatPrevious}
                  >
                    <Copy size={16} />
                    Repetir valores da série anterior
                  </Button>
                )}
                <Button
                  type="button"
                  className="complete-current"
                  onClick={(e) => {
                    if (e.currentTarget.form?.reportValidity())
                      completeCurrent();
                  }}
                >
                  <CheckCircle2 size={21} />
                  Concluir série atual
                </Button>
              </>
            ) : (
              <p>
                Revise suas séries e toque em Concluir treino para salvar o
                resumo.
              </p>
            )}
            <div className="focus-rest">
              <span>
                <Clock3 size={17} />
                {restLeft > 0
                  ? "Descanso: " +
                    Math.floor(restLeft / 60) +
                    ":" +
                    String(restLeft % 60).padStart(2, "0")
                  : "Pronto para a próxima série"}
              </span>
              {restLeft > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => startRest(0)}
                >
                  Pular descanso
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => startRest(currentExercise?.rest ?? 60)}
                >
                  Iniciar descanso
                </Button>
              )}
            </div>
          </section>
        )}
        <div className="form-grid">
          <Field label="Data do treino">
            <DateInput
              value={draft.date}
              required
              max={today()}
              onValueChange={(value) => persist({ ...draft, date: value })}
            />
          </Field>
          {draft.finishedAt && (
            <NumberField
              label="Duração (minutos)"
              value={draft.duration / 60}
              min={1}
              max={600}
              onChange={(v) =>
                Number.isFinite(v) && persist({ ...draft, duration: v * 60 })
              }
            />
          )}
        </div>
        {draft.exercises.map((ex, index) => {
          const previous = [...data.sessions]
            .filter(
              (s) => s.id !== draft.id && s.finishedAt && s.date <= draft.date,
            )
            .sort((a, b) => b.date.localeCompare(a.date))
            .flatMap((s) => s.exercises)
            .find((e) => e.exerciseId === ex.exerciseId);
          const isExpanded =
            !!draft.finishedAt ||
            ex.id === currentExercise?.id ||
            !!opened[ex.id];
          const done = ex.sets.length > 0 && ex.sets.every((set) => set.done);
          return (
            <section
              className={
                "session-exercise " +
                (ex.id === currentExercise?.id ? "focused-exercise" : "")
              }
              key={ex.id}
            >
              {!draft.finishedAt && (
                <button
                  type="button"
                  className="exercise-disclosure"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setOpened((prev) => ({ ...prev, [ex.id]: !isExpanded }))
                  }
                  disabled={ex.id === currentExercise?.id}
                >
                  <span>
                    {index + 1}. {ex.name}
                    <small>
                      {done
                        ? "Concluído · toque para revisar"
                        : ex.id === currentExercise?.id
                          ? "Exercício atual"
                          : ex.sets.length + " séries · toque para consultar"}
                    </small>
                  </span>
                  {done ? (
                    <CheckCircle2 size={21} />
                  ) : (
                    <ChevronDown size={21} />
                  )}
                </button>
              )}
              {isExpanded && (
                <>
                  <div className="session-exercise-header">
                    <span className="item-number">{index + 1}</span>
                    <div>
                      <h3>{ex.name}</h3>
                      <p>
                        {previous
                          ? "Anterior: " +
                            previous.sets
                              .filter((s) => s.done)
                              .map(
                                (s) =>
                                  fmt(
                                    weightDisplay(s.weight, data.profile.units),
                                    1,
                                  ) +
                                  " " +
                                  weightUnit(data.profile) +
                                  " × " +
                                  s.reps,
                              )
                              .join(" · ")
                          : "Seu primeiro registro deste exercício"}
                      </p>
                    </div>
                  </div>
                  <details className="exercise-options">
                    <summary>Opções do exercício</summary>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() =>
                        setExercises(
                          draft.exercises.filter((e) => e.id !== ex.id),
                        )
                      }
                    >
                      <Trash2 size={16} />
                      Remover {ex.name}
                    </Button>
                    <Field label="Nome do exercício">
                      <input
                        required
                        value={ex.name}
                        placeholder="Nome do exercício"
                        onChange={(e) =>
                          setExercises(
                            draft.exercises.map((v) =>
                              v.id === ex.id
                                ? {
                                    ...v,
                                    name: e.target.value,
                                    exerciseId:
                                      "custom-" +
                                      e.target.value
                                        .trim()
                                        .toLocaleLowerCase("pt-BR"),
                                  }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                  </details>
                  <div className="set-table">
                    <div className="set-table-head">
                      <span>Série</span>
                      <span>Carga ({weightUnit(data.profile)})</span>
                      <span>Repetições</span>
                      <span>Feita</span>
                      <span />
                    </div>
                    {ex.sets.map((set, i) => (
                      <div
                        className={
                          "set-row " +
                          (set.done ? "set-done" : "") +
                          (set.id === currentSet?.id && !draft.finishedAt
                            ? " current-set"
                            : "")
                        }
                        key={set.id}
                      >
                        <span>{i + 1}</span>
                        <input
                          aria-label={"Carga série " + (i + 1) + " " + ex.name}
                          type="number"
                          min={0}
                          step="any"
                          required
                          value={
                            +weightDisplay(
                              set.weight,
                              data.profile.units,
                            ).toFixed(2)
                          }
                          onChange={(e) => {
                            if (
                              e.target.value === "" ||
                              Number(e.target.value) < 0
                            )
                              return;
                            setExercises(
                              draft.exercises.map((v) =>
                                v.id === ex.id
                                  ? {
                                      ...v,
                                      sets: v.sets.map((s) =>
                                        s.id === set.id
                                          ? {
                                              ...s,
                                              weight: weightInternal(
                                                Number(e.target.value),
                                                data.profile.units,
                                              ),
                                            }
                                          : s,
                                      ),
                                    }
                                  : v,
                              ),
                            );
                          }}
                        />
                        <input
                          aria-label={
                            "Repetições série " + (i + 1) + " " + ex.name
                          }
                          type="number"
                          min={1}
                          max={200}
                          step={1}
                          required
                          value={set.reps}
                          onChange={(e) => {
                            if (
                              e.target.value === "" ||
                              Number(e.target.value) < 0
                            )
                              return;
                            setExercises(
                              draft.exercises.map((v) =>
                                v.id === ex.id
                                  ? {
                                      ...v,
                                      sets: v.sets.map((s) =>
                                        s.id === set.id
                                          ? {
                                              ...s,
                                              reps: Number(e.target.value),
                                            }
                                          : s,
                                      ),
                                    }
                                  : v,
                              ),
                            );
                          }}
                        />
                        <button
                          type="button"
                          className={"set-check " + (set.done ? "checked" : "")}
                          aria-label={
                            "Concluir série " + (i + 1) + " " + ex.name
                          }
                          aria-pressed={set.done}
                          onClick={() => {
                            setExercises(
                              draft.exercises.map((v) =>
                                v.id === ex.id
                                  ? {
                                      ...v,
                                      sets: v.sets.map((s) =>
                                        s.id === set.id
                                          ? { ...s, done: !s.done }
                                          : s,
                                      ),
                                    }
                                  : v,
                              ),
                            );
                            if (!set.done && !draft.finishedAt)
                              startRest(ex.rest);
                          }}
                        >
                          <Check size={17} />
                        </button>
                        <IconButton
                          type="button"
                          label={"Excluir série " + (i + 1) + " " + ex.name}
                          onClick={() =>
                            setExercises(
                              draft.exercises.map((v) =>
                                v.id === ex.id
                                  ? {
                                      ...v,
                                      sets: v.sets.filter(
                                        (s) => s.id !== set.id,
                                      ),
                                    }
                                  : v,
                              ),
                            )
                          }
                        >
                          <X size={13} />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() =>
                      setExercises(
                        draft.exercises.map((v) =>
                          v.id === ex.id
                            ? {
                                ...v,
                                sets: [
                                  ...v.sets,
                                  {
                                    id: uid(),
                                    weight: v.sets.at(-1)?.weight ?? 0,
                                    reps: v.sets.at(-1)?.reps ?? 12,
                                    done: false,
                                  },
                                ],
                              }
                            : v,
                        ),
                      )
                    }
                  >
                    <Plus size={15} />
                    Adicionar série
                  </button>
                </>
              )}
            </section>
          );
        })}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setExercises([
              ...draft.exercises,
              {
                id: uid(),
                exerciseId: "custom-" + uid(),
                name: "Novo exercício",
                rest: 60,
                sets: [{ id: uid(), weight: 0, reps: 12, done: false }],
              },
            ])
          }
        >
          <Plus size={16} />
          Adicionar exercício
        </Button>
        <ErrorBox message={task.error || saveError} />
        {saveError && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => persist(draft)}
          >
            Tentar salvar séries novamente
          </Button>
        )}
        <div className="form-actions spread">
          <Button type="button" variant="danger" onClick={discard}>
            <Trash2 size={16} />
            {draft.finishedAt ? "Excluir treino" : "Descartar treino"}
          </Button>
          <SaveButton busy={task.busy}>
            {draft.finishedAt ? "Salvar treino" : "Concluir treino"}
          </SaveButton>
        </div>
      </form>
    </Modal>
  );
}
