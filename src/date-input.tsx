import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import "./date-input.css";
export const displayDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : "";
export function parseDate(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const [day, month, year] = value.split("/");
  const iso = year + "-" + month + "-" + day;
  const parsed = new Date(iso + "T12:00:00Z");
  return Number(year) > 0 &&
    !isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
export function DateInput({
  value,
  onValueChange,
  min,
  max,
  required = true,
  disabled = false,
  "aria-label": label,
}: {
  value: string;
  onValueChange: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [raw, setRaw] = useState(displayDate(value));
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => setRaw(displayDate(value)), [value]);
  useEffect(() => {
    const iso = parseDate(raw);
    let error = "";
    if (raw && !iso) error = "Informe uma data válida no formato DD/MM/AAAA.";
    else if (iso && min && iso < min)
      error = "Escolha uma data a partir de " + displayDate(min) + ".";
    else if (iso && max && iso > max)
      error = "Escolha uma data até " + displayDate(max) + ".";
    input.current?.setCustomValidity(error);
  }, [raw, min, max]);
  return (
    <span className="date-control">
      <input
        ref={input}
        className="date-text"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/AAAA"
        aria-label={label}
        required={required}
        disabled={disabled}
        maxLength={10}
        value={raw}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
          const formatted =
            digits.length > 4
              ? digits.slice(0, 2) +
                "/" +
                digits.slice(2, 4) +
                "/" +
                digits.slice(4)
              : digits.length > 2
                ? digits.slice(0, 2) + "/" + digits.slice(2)
                : digits;
          setRaw(formatted);
          const iso = parseDate(formatted);
          if (iso) onValueChange(iso);
          else if (!formatted) onValueChange("");
        }}
      />
      <button
        type="button"
        className="date-calendar-button"
        aria-label={label ? "Abrir calendário: " + label : "Abrir calendário"}
        disabled={disabled}
        onClick={() => {
          try {
            if (picker.current?.showPicker) picker.current.showPicker();
            else input.current?.focus();
          } catch {
            input.current?.focus();
          }
        }}
      >
        <CalendarDays size={18} />
      </button>
      <input
        ref={picker}
        className="date-native"
        type="date"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          onValueChange(e.target.value);
          setRaw(displayDate(e.target.value));
        }}
      />
    </span>
  );
}
