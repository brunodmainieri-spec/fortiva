import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { calculateBasal, fmt, today } from "./domain";
import type { AppData, Profile } from "./domain";
import { Field, NumberField } from "./ui";

export function basalForProfile(profile: Profile): number | null {
  if (!profile.basalMode || profile.basalMode === "off") return null;
  if (profile.basalMode === "automatic")
    return Math.round(calculateBasal(profile));
  const calories = profile.basalManualCalories;
  if (calories === undefined || !Number.isFinite(calories) || calories <= 0)
    throw new Error("Informe um valor basal manual positivo em kcal/dia.");
  return calories;
}
export function withBasalProfile(
  data: AppData,
  profile: Profile,
  date = today(),
): AppData {
  const calories = basalForProfile(profile);
  const method = profile.basalMode ?? "off";
  const history = data.basalHistory ?? [];
  const previous = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((s) => s.date <= date);
  const changed = previous
    ? previous.calories !== calories || previous.method !== method
    : calories !== null;
  return {
    ...data,
    profile,
    basalHistory: changed
      ? [
          ...history.filter((s) => s.date !== date),
          { date, calories, method },
        ].sort((a, b) => a.date.localeCompare(b.date))
      : history,
  };
}
export function BasalFields({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const [showNotice, setShowNotice] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const changeMode = (basalMode: Profile["basalMode"]) => {
    if (basalMode === (profile.basalMode ?? "off")) return;
    onChange({ ...profile, basalMode });
    setShowNotice(true);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setShowNotice(false), 12_000);
  };
  let calories: number | null = null;
  let error = "";
  try {
    calories = basalForProfile(profile);
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <section className="basal-settings">
      <div className="subheading">
        <div>
          <h3>Metabolismo basal</h3>
          <p>Uma referência de energia em repouso para 24 horas.</p>
        </div>
      </div>
      <Field label="Cálculo basal no gasto diário">
        <select
          value={profile.basalMode ?? "off"}
          onChange={(e) => changeMode(e.target.value as Profile["basalMode"])}
        >
          <option value="off">Não usar referência basal</option>
          <option value="automatic">Calcular com meus dados</option>
          <option value="manual">Informar meu basal manualmente</option>
        </select>
      </Field>
      {showNotice && (
        <div className="basal-change-notice" role="alert">
          <TriangleAlert size={19} aria-hidden="true" />
          <div>
            <strong>Aviso sobre a alteração</strong>
            <p>
              Ao salvar, esta referência passa a valer a partir de hoje nos dias
              sem gasto total registrado. As datas anteriores preservam o valor
              salvo. Para atualizar a estimativa após mudanças de peso, idade ou
              altura, revise e salve o perfil novamente.
            </p>
          </div>
        </div>
      )}
      {profile.basalMode === "manual" && (
        <NumberField
          label="Metabolismo basal manual"
          suffix="kcal/dia"
          value={profile.basalManualCalories ?? 0}
          blankZero
          min={1}
          onChange={(basalManualCalories) =>
            onChange({ ...profile, basalManualCalories })
          }
        />
      )}
      {calories !== null && (
        <div className="basal-result">
          <span>
            {profile.basalMode === "manual"
              ? "Basal informado"
              : "Basal estimado"}
          </span>
          <strong>
            {fmt(calories)} <small>kcal/dia</small>
          </strong>
        </div>
      )}
      {error && <p className="info-box">{error}</p>}

      <details className="formula-details">
        <summary>Como calculamos o basal?</summary>
        <p>
          Usamos Mifflin–St Jeor: 10 × peso (kg) + 6,25 × altura (cm) − 5 ×
          idade + coeficiente (+5 ou −161). A equação estima gasto energético em
          repouso, usado aqui como referência basal para adultos.
        </p>
        <p>
          Não aplicamos fator de atividade, calorias de treino ou ajuste de
          cutting/bulking. Esse valor não é o gasto total diário nem uma
          recomendação de quanto comer. O saldo em relação ao basal fica
          separado do déficit/superávit calculado com gasto total e não gera
          projeção de peso.
        </p>
        <a
          href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
          target="_blank"
          rel="noreferrer"
        >
          Referência da equação de Mifflin–St Jeor
        </a>
      </details>
    </section>
  );
}
