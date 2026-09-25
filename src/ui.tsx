import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { fmt, MACRO_LABELS } from "./domain";
import type { Macros } from "./domain";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <img src="/fortiva-logo.png" alt="FORTIVA" width={40} height={40} />
      </span>
      {!compact && (
        <span>
          FORTIVA
          <small>EVOLUA NO SEU RITMO</small>
        </span>
      )}
    </div>
  );
}
export function Button({
  children,
  variant = "primary",
  loading = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={"btn btn-" + variant + " " + (props.className ?? "")}
    >
      {loading && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function IconButton({
  children,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      className={"icon-btn " + (props.className ?? "")}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={"field " + className}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = "any",
  suffix,
  required = true,
  blankZero = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  suffix?: string;
  required?: boolean;
  blankZero?: boolean;
}) {
  const format = (n: number) =>
    Number.isFinite(n) && !(blankZero && n === 0) ? String(+n.toFixed(3)) : "";
  const [raw, setRaw] = useState(format(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setRaw(format(value));
  }, [value, blankZero]);
  return (
    <Field label={label}>
      <div className="input-suffix">
        <input
          type="number"
          value={raw}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            if (raw !== "") setRaw(format(value));
          }}
          onChange={(e) => {
            setRaw(e.target.value);
            if (blankZero && e.target.value === "") onChange(0);
            if (
              e.target.value !== "" &&
              Number.isFinite(Number(e.target.value))
            )
              onChange(Number(e.target.value));
          }}
          min={min}
          max={max}
          step={step}
          required={required}
        />
        {suffix && <span>{suffix}</span>}
      </div>
    </Field>
  );
}
export function ErrorBox({ message }: { message?: string }) {
  return message ? (
    <div role="alert" className="error-box">
      {message}
    </div>
  ) : null;
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement;
    el?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className={"modal " + (wide ? "modal-wide" : "")}
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="modal-header">
        <div>
          <span className="eyebrow">FORTIVA</span>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <IconButton label="Fechar" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-action">{action}</div>}
    </div>
  );
}
export function Empty({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <Plus />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function MacroBar({
  name,
  value,
  goal,
}: {
  name: "protein" | "carbs" | "fat";
  value: number;
  goal: number | null;
}) {
  const excess = goal === null ? 0 : Math.max(0, value - goal);
  const scale = Math.max(value, goal ?? 0, 1);
  const withinPercent =
    goal === null ? 0 : (Math.min(value, goal) / scale) * 100;
  const excessPercent = (excess / scale) * 100;
  const description = `${MACRO_LABELS[name]}: ${fmt(value, 1)} g consumidos; ${goal === null ? "sem meta para esta data" : `meta de ${fmt(goal, 1)} g${excess > 0 ? `; ${fmt(excess, 1)} g acima da meta` : ""}`}.`;
  return (
    <div className={"macro-bar macro-" + name}>
      <div className="macro-label">
        <span>
          <i />
          {MACRO_LABELS[name]}
        </span>
        <strong>
          {fmt(value)}
          <small> / {goal === null ? "—" : fmt(goal)} g</small>
        </strong>
      </div>
      <div
        className="bar-track"
        role="img"
        aria-label={description}
        title={description}
      >
        <div className="macro-within" style={{ width: withinPercent + "%" }} />
        {excess > 0 && (
          <div
            className="macro-excess"
            style={{ width: excessPercent + "%" }}
          />
        )}
      </div>
      {goal !== null && goal > 0 && (
        <p className="macro-percentage">{fmt((value / goal) * 100)}% da meta</p>
      )}
      {excess > 0 && (
        <p className="macro-excess-note">
          +{fmt(excess, 1)} g acima da meta · trecho escuro
        </p>
      )}
    </div>
  );
}
export function MacroChips({ macros }: { macros: Macros }) {
  return (
    <div className="macro-chips">
      <span className="protein-dot">
        P <b>{fmt(macros.protein, 1)}g</b>
      </span>
      <span className="carbs-dot">
        C <b>{fmt(macros.carbs, 1)}g</b>
      </span>
      <span className="fat-dot">
        G <b>{fmt(macros.fat, 1)}g</b>
      </span>
    </div>
  );
}
export function Ring({ value, goal }: { value: number; goal: number }) {
  const r = 83,
    circumference = 2 * Math.PI * r;
  return (
    <div className="energy-ring">
      <svg
        viewBox="0 0 200 200"
        aria-label={fmt(value) + " de " + fmt(goal) + " calorias"}
      >
        <circle cx="100" cy="100" r={r} className="ring-track" />
        <circle
          cx="100"
          cy="100"
          r={r}
          className="ring-value"
          strokeDasharray={circumference}
          strokeDashoffset={
            circumference * (1 - Math.min(1, goal ? value / goal : 0))
          }
        />
        {goal > 0 && value > goal && (
          <circle
            cx="100"
            cy="100"
            r={94}
            className="ring-excess"
            strokeDasharray={2 * Math.PI * 94}
            strokeDashoffset={
              2 * Math.PI * 94 * (1 - Math.min(1, (value - goal) / goal))
            }
          />
        )}
      </svg>
      <div>
        <span className="ring-flame">ϟ</span>
        <strong>{fmt(value)}</strong>
        <span>de {fmt(goal)} kcal</span>
      </div>
    </div>
  );
}
export function StatCard({
  label,
  value,
  unit,
  detail,
  icon,
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  icon?: ReactNode;
  trend?: "up" | "down";
}) {
  return (
    <div className="card stat-card">
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="stat-detail">
        {trend === "down" ? (
          <ArrowDownRight size={15} />
        ) : trend === "up" ? (
          <ArrowUpRight size={15} />
        ) : null}
        {detail}
      </div>
    </div>
  );
}
export function SectionHeading({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>
        {title}
        {count !== undefined && <span className="count">{count}</span>}
      </h2>
      {action}
    </div>
  );
}
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-pressed={value === o.value}
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function MealArt({ type, photo }: { type: string; photo?: string }) {
  if (photo) return <img className="meal-art" src={photo} alt={type} />;
  const breakfast = type.includes("Café"),
    snack = type.includes("Lanche");
  return (
    <div
      className={
        "meal-art " +
        (breakfast ? "art-breakfast" : snack ? "art-snack" : "art-lunch")
      }
      aria-hidden="true"
    >
      <div className="plate">
        {breakfast ? (
          <>
            <div className="bread-toast" />
            <div className="egg" />
            <div className="leaf l1" />
            <div className="leaf l2" />
          </>
        ) : snack ? (
          <>
            <div className="yogurt" />
            <div className="berry b1" />
            <div className="berry b2" />
            <div className="berry b3" />
          </>
        ) : (
          <>
            <div className="rice" />
            <div className="chicken" />
            <div className="leaf l1" />
            <div className="leaf l2" />
            <div className="leaf l3" />
          </>
        )}
      </div>
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="text-link" onClick={onClick}>
      {children}
      <ChevronRight size={15} />
    </button>
  );
}
export function SaveButton({
  busy,
  children = "Salvar alterações",
}: {
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <Button type="submit" loading={busy}>
      <Check size={17} />
      {children}
    </Button>
  );
}
export function useFormTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export function ContextActions({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  return (
    <details
      ref={ref}
      className="context-actions"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
          ref.current?.querySelector("summary")?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          close();
      }}
    >
      <summary aria-label={label} title={label}>
        <MoreHorizontal size={19} />
      </summary>
      <div
        className="context-actions-panel"
        onClick={(event) => {
          if ((event.target as Element).closest("button")) {
            close();
            ref.current?.querySelector("summary")?.focus();
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}
