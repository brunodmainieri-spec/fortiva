import { AssistantMessage } from "./assistant-message";
import { DateInput, displayDate } from "./date-input";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import { useData } from "./store";
import { periodDates, shiftDate, today } from "./domain";
import { Button, ErrorBox, Field, Modal } from "./ui";
import {
  buildAssistantFacts,
  QUESTIONS,
  TOPIC_LABELS,
} from "./assistant-domain";
import type {
  AssistantAnswer,
  AssistantSelection,
  AssistantTopic,
} from "./assistant-domain";
import { conversationService } from "./assistant-service";
import "./assistant.css";

type OpenAssistant = (selection: AssistantSelection) => void;
const AssistantContext = createContext<OpenAssistant | null>(null);
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<{
    selection: AssistantSelection;
    key: number;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const open: OpenAssistant = (selection) => {
    if (!view || JSON.stringify(selection) !== JSON.stringify(view.selection))
      setView({ selection, key: Date.now() });
    setVisible(true);
  };
  return (
    <AssistantContext.Provider value={open}>
      {children}
      {view && (
        <AssistantChat
          key={view.key}
          selection={view.selection}
          visible={visible}
          onClose={() => setVisible(false)}
        />
      )}
    </AssistantContext.Provider>
  );
}
function useAssistant() {
  const open = useContext(AssistantContext);
  if (!open) throw new Error("AssistantProvider ausente");
  return open;
}
export function ExplainButton({
  selection,
}: {
  selection: AssistantSelection;
}) {
  const open = useAssistant();
  return (
    <button
      type="button"
      className="explain-button"
      title={`Entender este resultado: ${TOPIC_LABELS[selection.topic]}`}
      aria-label={`Entender este resultado: ${TOPIC_LABELS[selection.topic]}`}
      onClick={() => open(selection)}
    >
      <Sparkles size={15} />
      <span className="visually-hidden">Entender este resultado</span>
    </button>
  );
}
export function AssistantLauncher() {
  const open = useAssistant();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const raw = params.get("date");
  const date =
    raw &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw) &&
    shiftDate(raw, 0) === raw &&
    raw <= today()
      ? raw
      : today();
  const p = params.get("period");
  const period =
    location.pathname === "/"
      ? "day"
      : p === "day" || p === "week" || p === "month"
        ? p
        : location.pathname === "/evolucao"
          ? "month"
          : "week";
  return (
    <button
      className="assistant-launcher"
      aria-label="Abrir assistente"
      onClick={() =>
        open({ topic: "summary", dates: periodDates(date, period) })
      }
    >
      <MessageCircle size={18} />
      <span>Assistente</span>
    </button>
  );
}
type Turn = {
  id: number;
  question: string;
  answer?: AssistantAnswer;
  signature?: string;
  error?: string;
};
function AssistantChat({
  selection: initialSelection,
  visible,
  onClose,
}: {
  selection: AssistantSelection;
  visible: boolean;
  onClose: () => void;
}) {
  const data = useData();
  const [selection, setSelection] = useState(initialSelection);
  const [rangeStart, setRangeStart] = useState(
    initialSelection.dates[0] ?? today(),
  );
  const [rangeEnd, setRangeEnd] = useState(
    initialSelection.dates.at(-1) ?? today(),
  );
  const [rangeError, setRangeError] = useState("");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const facts = useMemo(
    () => buildAssistantFacts(data, selection),
    [data, selection],
  );
  const signature = JSON.stringify(facts);
  const last = turns.at(-1);
  const previous = [...turns]
    .reverse()
    .find((t) => t.answer && t.answer.topic !== "unsupported")?.answer
    ?.topic as AssistantTopic | undefined;
  const send = async (question: string, retry = false, initial = false) => {
    if (controller.current || !question.trim()) return;
    const id = ++sequence.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    const turn = { id, question: question.trim() };
    setTurns((old) =>
      initial ? [turn] : [...(retry ? old.slice(0, -1) : old).slice(-11), turn],
    );
    setInput("");
    try {
      const answer = await conversationService.reply(
        {
          question: turn.question,
          selection,
          facts,
          previousTopic: previous,
          history: turns
            .filter((t) => t.answer)
            .slice(-6)
            .map((t) => ({
              question: t.question,
              answer: t.answer!.paragraphs.join("\n\n").slice(0, 6000),
            })),
        },
        abort.signal,
      );
      if (abort.signal.aborted || sequence.current !== id) return;
      setTurns((old) =>
        old.map((t) => (t.id === id ? { ...t, answer, signature } : t)),
      );
    } catch (error) {
      if (abort.signal.aborted || sequence.current !== id) return;
      setTurns((old) =>
        old.map((t) =>
          t.id === id ? { ...t, error: (error as Error).message } : t,
        ),
      );
    } finally {
      if (sequence.current === id) {
        controller.current = null;
        setBusy(false);
      }
    }
  };
  const cancel = () => {
    controller.current?.abort();
    controller.current = null;
    sequence.current += 1;
    setBusy(false);
    setTurns((old) =>
      old.map((t) =>
        !t.answer && !t.error
          ? {
              ...t,
              error: "Resposta interrompida. Você pode tentar novamente.",
            }
          : t,
      ),
    );
  };
  useEffect(() => {
    return () => {
      controller.current?.abort();
      controller.current = null;
      sequence.current += 1;
    };
  }, []);
  useEffect(() => {
    if (visible) end.current?.scrollIntoView({ block: "nearest" });
  }, [turns, busy, visible]);
  if (!visible) return null;
  const close = () => {
    if (controller.current) cancel();
    onClose();
  };
  const suggestions: AssistantTopic[] = [
    ...new Set<AssistantTopic>([
      selection.topic,
      "summary",
      "training",
      "macros",
    ]),
  ].slice(0, 3);
  const stale = last?.signature && last.signature !== signature;
  return (
    <Modal
      title="Seu assistente"
      subtitle="Alimentação, treino e evolução em uma conversa."
      onClose={close}
    >
      <div className="assistant-chat">
        <div className="assistant-toolbar">
          <details className="assistant-context">
            <summary>
              <span className="context-heading">
                Contexto{" "}
                <span className="context-count">
                  {facts.dates.length}{" "}
                  {facts.dates.length === 1 ? "dia" : "dias"}
                </span>
              </span>
              <span className="context-period">
                {displayDate(facts.dates[0] ?? "")}
                {facts.dates.length > 1 &&
                  " — " + displayDate(facts.dates.at(-1) ?? "")}
              </span>
            </summary>
            <form
              className="assistant-range"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  !rangeStart ||
                  !rangeEnd ||
                  shiftDate(rangeStart, 0) !== rangeStart ||
                  shiftDate(rangeEnd, 0) !== rangeEnd ||
                  rangeStart > rangeEnd ||
                  rangeEnd > today()
                ) {
                  setRangeError("Escolha datas válidas, em ordem e até hoje.");
                  return;
                }
                const dates: string[] = [];
                for (
                  let day = rangeStart;
                  day <= rangeEnd && dates.length < 32;
                  day = shiftDate(day, 1)
                )
                  dates.push(day);
                if (dates.length > 31) {
                  setRangeError("Escolha um período de até 31 dias.");
                  return;
                }
                setSelection({ ...selection, dates });
                setRangeError("");
              }}
            >
              <Field label="Data inicial">
                <DateInput
                  required
                  max={rangeEnd || today()}
                  value={rangeStart}
                  disabled={busy}
                  onValueChange={(value) => setRangeStart(value)}
                />
              </Field>
              <Field label="Data final">
                <DateInput
                  required
                  min={rangeStart}
                  max={today()}
                  value={rangeEnd}
                  disabled={busy}
                  onValueChange={(value) => setRangeEnd(value)}
                />
              </Field>
              <ErrorBox message={rangeError} />
              <Button type="submit" variant="secondary" disabled={busy}>
                Aplicar período
              </Button>
            </form>
          </details>
          {!!turns.length && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() => {
                setTurns([]);
                setInput("");
              }}
            >
              Nova conversa
            </button>
          )}
        </div>
        <div
          className="assistant-transcript"
          role="log"
          aria-label="Conversa com o assistente"
          aria-live="polite"
          aria-relevant="additions text"
          aria-busy={busy}
        >
          {!turns.length && (
            <div className="assistant-welcome">
              <Sparkles size={26} />
              <h3>Como posso ajudar?</h3>
              <p>
                Tire uma dúvida ou entenda os registros do período selecionado.
              </p>
              <div
                className="assistant-suggestions"
                aria-label="Perguntas sugeridas"
              >
                {suggestions.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => void send(QUESTIONS[topic])}
                  >
                    {QUESTIONS[topic]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((turn) => (
            <article className="assistant-turn" key={turn.id}>
              <p className="assistant-question">
                <span>Você</span>
                {turn.question}
              </p>
              {turn.answer && (
                <div className="assistant-answer">
                  <AssistantMessage paragraphs={turn.answer.paragraphs} />
                </div>
              )}
              {turn.error && <ErrorBox message={turn.error} />}
            </article>
          ))}
          {busy && (
            <p className="assistant-progress" role="status">
              Preparando uma resposta…
            </p>
          )}
          <div ref={end} />
        </div>
        {stale && (
          <p className="info-box" role="status">
            Os registros mudaram desde a última resposta. Faça uma nova pergunta
            para usar os dados atualizados.
          </p>
        )}
        {last?.error && !busy && (
          <Button
            variant="secondary"
            onClick={() => void send(last.question, true)}
          >
            Tentar novamente
          </Button>
        )}
        <form
          className="assistant-compose"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <Field label="Sua pergunta">
            <textarea
              value={input}
              maxLength={600}
              rows={2}
              placeholder="Pergunte sobre alimentação, treino ou seus registros…"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  if (!busy) void send(input);
                }
              }}
            />
          </Field>
          <div className="assistant-compose-actions">
            {busy ? (
              <Button variant="secondary" type="button" onClick={cancel}>
                Interromper
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()}>
                <Send size={16} />
                Enviar
              </Button>
            )}
          </div>
        </form>
      </div>
    </Modal>
  );
}
