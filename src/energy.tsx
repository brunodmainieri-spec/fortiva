import { DateInput } from "./date-input";
import { BasalFields, withBasalProfile } from "./basal";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Flame,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
  Unplug,
  Watch,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EnergyEntry, EnergyProvider } from "./domain";
import {
  dateLabel,
  fmt,
  today,
  uid,
  weightDisplay,
  weightUnit,
} from "./domain";
import {
  ENERGY_KCAL_PER_KG,
  ENERGY_SOURCES,
  energyStats,
  mergeEnergy,
  validateEnergy,
} from "./energy-domain";
import { wearableService } from "./services";
import { useApp, useData } from "./store";
import {
  Button,
  Empty,
  ErrorBox,
  Field,
  IconButton,
  Modal,
  NumberField,
  SaveButton,
  SectionHeading,
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
const axisStyle = { fontSize: 10, fill: "#9daec1" };
const signed = (n: number, digits = 0) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n), digits)}`;

export function EnergyPanel({
  dates,
  anchor,
  onOpenDiary,
}: {
  dates: string[];
  anchor: string;
  onOpenDiary: (path: string) => void;
}) {
  const data = useData();
  const location = useLocation();
  useEffect(() => {
    if (location.hash === "#registros-energia")
      document
        .getElementById("registros-energia")
        ?.scrollIntoView({ block: "start" });
  }, [location.hash, location.search]);
  const { update, notify } = useApp();
  const task = useFormTask();
  const [basalOpen, setBasalOpen] = useState(false);
  const [provider, setProvider] = useState<EnergyProvider>("garmin");
  const [preview, setPreview] = useState<EnergyEntry[] | null>(null);
  const [editing, setEditing] = useState<EnergyEntry | "new" | null>(null);
  const stats = energyStats(data, dates);
  const connection = data.energyConnection;
  const basalSnapshot = [...(data.basalHistory ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((s) => s.date <= anchor);
  const basalReference = basalSnapshot?.calories ?? null;
  const chart = stats.rows.map((r) => ({
    ...r,
    label: dateLabel(r.date, { day: "numeric", month: "short" }),
    balance: r.closed && r.foodConfirmed ? r.balance : null,
  }));
  const replaced =
    preview?.filter((entry) =>
      data.energy.some((old) => old.date === entry.date),
    ).length ?? 0;
  const connect = () =>
    task.run(async () => {
      const next = await wearableService.connect(provider);
      await update((d) => ({ ...d, energyConnection: next }));
      notify("Conexão simulada criada. Nenhuma conta externa foi acessada.");
    });
  const sync = () =>
    task.run(async () => {
      if (connection)
        setPreview(await wearableService.fetchDaily(connection.provider));
    });
  const confirmImport = () =>
    task.run(async () => {
      if (!preview || !connection) return;
      preview.forEach(validateEnergy);
      await update((d) => ({
        ...d,
        energy: mergeEnergy(d.energy, preview),
        energyConnection: { ...connection, syncedAt: new Date().toISOString() },
      }));
      setPreview(null);
      notify("Gastos demonstrativos importados. Balanço atualizado.");
    });
  const disconnect = () => {
    if (
      !window.confirm(
        "Desconectar esta simulação? Os registros já importados serão mantidos.",
      )
    )
      return;
    void task.run(async () => {
      await wearableService.disconnect();
      await update((d) => ({ ...d, energyConnection: undefined }));
      notify("Simulação desconectada.");
    });
  };
  const remove = (entry: EnergyEntry) => {
    void task.run(async () => {
      await update((d) => ({
        ...d,
        energy: d.energy.filter((e) => e.id !== entry.id),
      }));
      notify("Gasto excluído.", async () => {
        await update((d) => {
          if (d.energy.some((e) => e.date === entry.date))
            throw new Error(
              "Já existe outro gasto nesta data. Remova-o antes de restaurar este registro.",
            );
          return { ...d, energy: [...d.energy, entry] };
        });
      });
    });
  };
  return (
    <div className="energy-panel">
      <section className="card energy-intro">
        <SectionHeading
          title="Seu gasto de energia"
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus size={17} />
              Registrar gasto
            </Button>
          }
        />
      </section>
      <div className="stats-row energy-primary-stats">
        <StatCard
          label="Consumo registrado"
          value={
            stats.rows.some((row) => row.consumed !== null)
              ? fmt(
                  stats.rows.reduce((sum, row) => sum + (row.consumed ?? 0), 0),
                )
              : "—"
          }
          unit="kcal"
          detail="Todos os registros, incluindo parciais"
        />
        <StatCard
          label="Gasto total registrado"
          value={stats.total === null ? "—" : fmt(stats.total)}
          unit={stats.total === null ? "" : "kcal"}
          detail={stats.totalDays + " dias com gasto total informado"}
          icon={<Flame size={19} />}
        />
        <StatCard
          label="Saldo energético"
          value={stats.net === null ? "—" : signed(stats.net)}
          unit={stats.net === null ? "" : "kcal"}
          detail={
            stats.comparableDays +
            " dias confirmados e encerrados · consumo − gasto total"
          }
        />
        <StatCard
          label="Dias comparáveis"
          value={String(stats.comparableDays)}
          unit={"/ " + stats.rows.length}
          detail="Alimentação confirmada e gasto total, até ontem"
        />
      </div>
      <details className="quiet-details energy-rules">
        <summary>Como o saldo é calculado</summary>
        <p>
          Consumo menos gasto total, apenas em dias encerrados com alimentação
          confirmada. Hoje fica fora do saldo. Os cartões de consumo e gasto
          incluem registros parciais; subtrair seus totais pode diferir do
          saldo.
        </p>
      </details>
      <div className="energy-charts">
        <section className="card chart-card">
          <SectionHeading title="Consumo e gasto diário" />
          <p className="chart-description">
            Valores em kcal. Lacunas indicam ausência de dados.
          </p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chart}
                margin={{ top: 10, right: 10, left: -15, bottom: 5 }}
              >
                <CartesianGrid
                  stroke="#203b53"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis dataKey="label" tick={axisStyle} minTickGap={22} />
                <YAxis tick={axisStyle} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => `${fmt(Number(value))} kcal`}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as
                      (typeof chart)[number] | undefined;
                    return row
                      ? `${label} · ${row.consumed === null ? "sem alimentação" : row.foodConfirmed ? "alimentação confirmada" : "alimentação em andamento"}${!row.closed ? " · hoje parcial" : ""}`
                      : String(label);
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="total"
                  name="Gasto total"
                  fill="#8bbce2"
                  maxBarSize={30}
                  isAnimationActive={false}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  dataKey="consumed"
                  name="Consumido"
                  stroke="#f4f0e8"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="basal"
                  name="Somente basal · referência"
                  stroke="#b7c9e2"
                  strokeDasharray="5 5"
                  dot={{ r: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card chart-card">
          <SectionHeading title="Saldo por dia confirmado" />
          <p className="chart-description">
            Azul: déficit · Vermelho: superávit · Zero: equilíbrio.
          </p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chart}
                margin={{ top: 10, right: 10, left: -15, bottom: 5 }}
              >
                <CartesianGrid
                  stroke="#203b53"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis dataKey="label" tick={axisStyle} minTickGap={22} />
                <YAxis tick={axisStyle} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [
                    `${signed(Number(value))} kcal`,
                    Number(value) < 0
                      ? "Déficit"
                      : Number(value) > 0
                        ? "Superávit"
                        : "Equilíbrio",
                  ]}
                />
                <ReferenceLine
                  y={0}
                  stroke="#9daec1"
                  ifOverflow="extendDomain"
                />
                <Bar
                  dataKey="balance"
                  name="Saldo"
                  maxBarSize={30}
                  isAnimationActive={false}
                >
                  {chart.map((row) => (
                    <Cell
                      key={row.date}
                      fill={(row.balance ?? 0) > 0 ? "#ff8585" : "#8bbce2"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <details className="card energy-disclosure">
        <summary>
          <span>Detalhes do balanço e do peso</span>
          <small>Déficit, superávit, atividade e pesagens</small>
        </summary>
        <div className="disclosure-content">
          {" "}
          <div className="stats-row two">
            <StatCard
              label="Calorias de atividade"
              value={stats.recordedDays ? fmt(stats.active) : "—"}
              unit="kcal"
              detail="Já incluídas no total, quando informado"
              icon={<Activity size={19} />}
            />
            <StatCard
              label="Tempo de atividade"
              value={stats.recordedDays ? fmt(stats.minutes) : "—"}
              unit="min"
              detail="Tempo registrado pelas fontes do período"
              icon={<Watch size={19} />}
            />
          </div>
          <section aria-label="Déficit e superávit energético">
            <div className="calorie-balance-grid">
              <div className="calorie-below">
                <StatCard
                  label="Déficit energético"
                  value={stats.comparableDays ? fmt(stats.deficit) : "—"}
                  unit={stats.comparableDays ? "kcal" : ""}
                  detail="Soma dos dias em que o gasto superou o consumo"
                />
              </div>
              <div className="calorie-excess">
                <StatCard
                  label="Superávit energético"
                  value={stats.comparableDays ? fmt(stats.surplus) : "—"}
                  unit={stats.comparableDays ? "kcal" : ""}
                  detail="Soma dos dias em que o consumo superou o gasto"
                />
              </div>
            </div>
            <div className="stats-row two">
              <StatCard
                label="Equivalente teórico em peso"
                value={
                  stats.theoreticalKg === null
                    ? "—"
                    : signed(
                        weightDisplay(stats.theoreticalKg, data.profile.units),
                        2,
                      )
                }
                unit={
                  stats.theoreticalKg === null ? "" : weightUnit(data.profile)
                }
                detail="Estimativa simplificada, não uma previsão"
                icon={<Scale size={19} />}
              />
              <StatCard
                label="Variação registrada na balança"
                value={
                  stats.observed
                    ? signed(
                        weightDisplay(stats.observed.kg, data.profile.units),
                        2,
                      )
                    : "—"
                }
                unit={stats.observed ? weightUnit(data.profile) : ""}
                detail={
                  stats.observed
                    ? `${dateLabel(stats.observed.from)} a ${dateLabel(stats.observed.to)} · medições registradas`
                    : "Registre pesos em duas datas neste período"
                }
                icon={<Scale size={19} />}
              />
            </div>
            <p className="chart-description">
              Balanço calculado em {stats.comparableDays} dias encerrados com
              alimentação confirmada e gasto total registrado. Hoje e dias sem
              dados completos para comparação ficam fora. Refeições não
              registradas podem distorcer o resultado.
            </p>
            <details className="formula-details">
              <summary>Como o saldo se relaciona com o peso?</summary>
              <div className="info-box">
                O gasto total já inclui as calorias de atividade. Os treinos do
                app não são somados novamente e sua meta alimentar permanece
                independente deste balanço.
              </div>
              <p>
                Déficit = gasto maior que consumo. Superávit = consumo maior que
                gasto. Estar abaixo da meta alimentar não significa
                necessariamente estar em déficit energético.
              </p>
              <p>
                Para dar uma ordem de grandeza, dividimos o saldo por{" "}
                {fmt(ENERGY_KCAL_PER_KG)} kcal/kg. Por exemplo, −7.700 kcal
                equivalem teoricamente a −1 kg. Essa aproximação estática não
                prevê perda ou ganho real: água, composição corporal, adaptação
                metabólica e erros de registro influenciam o peso.
              </p>
              <p>
                A variação na balança é calculada entre a primeira e a última
                medição no período, nas datas indicadas. O equivalente teórico
                usa apenas os dias comparáveis e pode cobrir um intervalo
                diferente. Valores provenientes da demonstração e das conexões
                simuladas são fictícios.
              </p>
              <a
                href="https://www.niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner"
                target="_blank"
                rel="noreferrer"
              >
                Entenda os modelos de mudança de peso · NIDDK
              </a>
            </details>
          </section>
        </div>
      </details>
      <details className="card energy-disclosure basal-daily">
        <summary>
          <span>Metabolismo basal</span>
          <small>
            {stats.rows.find((row) => row.date === anchor)?.total !== null &&
            stats.rows.find((row) => row.date === anchor)?.total !== undefined
              ? "Gasto total tem prioridade nesta data"
              : basalReference === null
                ? basalSnapshot
                  ? "Desativado"
                  : "Não configurado"
                : `${fmt(basalReference)} kcal/dia · somente repouso`}
          </small>
        </summary>
        <div className="disclosure-content">
          <SectionHeading
            title="Somente metabolismo basal"
            action={
              <Button variant="secondary" onClick={() => setBasalOpen(true)}>
                Configurar basal
              </Button>
            }
          />
          <p className="chart-description">
            Referência de 24 horas em repouso. Usada somente quando não há gasto
            total registrado, sem somar atividade ou substituir valores de
            relógios.
          </p>
          <div className="stats-row three">
            <StatCard
              label="Referência basal diária"
              value={basalReference === null ? "—" : fmt(basalReference)}
              unit={basalReference === null ? "" : "kcal/dia"}
              detail={`Valor salvo para ${dateLabel(anchor)}`}
            />
            <StatCard
              label="Basal usado no período"
              value={stats.basalDays ? fmt(stats.basalTotal) : "—"}
              unit={stats.basalDays ? "kcal" : ""}
              detail={`${stats.basalDays} dias sem gasto total · referência de 24 h`}
            />
            <StatCard
              label="Saldo em relação ao basal"
              value={stats.basalComparedDays ? signed(stats.basalNet) : "—"}
              unit={stats.basalComparedDays ? "kcal" : ""}
              detail={`Consumo − basal · ${stats.basalComparedDays} dias encerrados e confirmados`}
            />
          </div>
          <p className="muted small">
            Esta comparação não representa o déficit/superávit total e não entra
            no equivalente teórico de peso. Hoje não entra no saldo acumulado; o
            basal exibido para hoje é a referência de um dia inteiro.
          </p>
        </div>
      </details>
      <details className="card energy-disclosure energy-connections">
        <summary>
          <span>Fontes de dados e dispositivos</span>
          <small>
            {connection
              ? ENERGY_SOURCES[connection.provider] + " · conexão simulada"
              : "Integrações em breve"}
          </small>
        </summary>
        <div className="disclosure-content">
          <SectionHeading title="Contas e dispositivos" />
          {stats.simulatedDays > 0 && (
            <p className="info-box">
              Este período contém {stats.simulatedDays} registros de gasto
              simulados. Os indicadores usam esses valores fictícios.
            </p>
          )}

          <p className="chart-description">
            As integrações com Strava, Garmin e relógios ainda não estão
            disponíveis. Por enquanto, registre os gastos manualmente.
          </p>
          {connection ? (
            <>
              <div className="energy-connection-state">
                <Link2 size={20} />
                <div>
                  <strong>
                    {ENERGY_SOURCES[connection.provider]} · conexão simulada
                  </strong>
                  <p>
                    {connection.syncedAt
                      ? "Última importação: " +
                        new Date(connection.syncedAt).toLocaleString("pt-BR")
                      : "Nenhum dado importado desta conexão."}
                  </p>
                </div>
              </div>
              <div className="button-row">
                <Button
                  disabled
                  loading={task.busy}
                  onClick={() => void sync()}
                >
                  <RefreshCw size={16} />
                  Importação indisponível
                </Button>
                <Button
                  variant="secondary"
                  disabled={task.busy}
                  onClick={disconnect}
                >
                  <Unplug size={16} />
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <div className="energy-connection-form">
              <Field label="Fonte de energia">
                <select
                  value={provider}
                  onChange={(e) =>
                    setProvider(e.target.value as EnergyProvider)
                  }
                >
                  <option value="garmin">Garmin</option>
                  <option value="strava">Strava</option>
                  <option value="watch">Outro relógio</option>
                </select>
              </Field>
              <Button
                disabled
                loading={task.busy}
                onClick={() => void connect()}
              >
                <Link2 size={16} />
                Em breve
              </Button>
            </div>
          )}
          <p className="muted small">
            Informe o gasto total do dia manualmente para calcular o balanço.
          </p>
          {!preview && <ErrorBox message={task.error} />}
        </div>
      </details>
      <details
        id="registros-energia"
        open={location.hash === "#registros-energia"}
        className="card energy-disclosure energy-records table-card"
      >
        <summary>
          <span>Registros de energia</span>
          <small>
            {stats.recordedDays} dias com gasto registrado · consultar e
            corrigir
          </small>
        </summary>
        <div className="disclosure-content">
          <p className="chart-description">
            Uma fonte por dia. O basal só é usado como referência onde falta
            gasto total e não é somado às atividades.
          </p>
          {!stats.rows.some((r) => r.entry || r.basal !== null) ? (
            <Empty
              title="Nenhum gasto neste período"
              description="Registre seu gasto diário ou configure o basal."
            />
          ) : (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Dia / fonte</th>
                    <th>Atividade</th>
                    <th>Tempo</th>
                    <th>Gasto total / basal</th>
                    <th>Consumo</th>
                    <th>Saldo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.rows]
                    .reverse()
                    .filter((r) => r.entry || r.basal !== null)
                    .map((row) => (
                      <tr key={row.date}>
                        <td data-label="Dia / fonte">
                          {dateLabel(row.date)}
                          <small className="energy-source">
                            {row.entry
                              ? ENERGY_SOURCES[row.entry.source]
                              : "Basal estimado"}
                            {row.entry?.simulated ? " · simulado" : ""}
                          </small>
                        </td>
                        <td data-label="Atividade">
                          {row.entry
                            ? `${fmt(row.entry.activeCalories)} kcal`
                            : "—"}
                        </td>
                        <td data-label="Tempo">
                          {row.entry ? `${fmt(row.entry.minutes)} min` : "—"}
                        </td>
                        <td data-label="Gasto total / basal">
                          {row.total !== null
                            ? `${fmt(row.total)} kcal`
                            : row.basal !== null
                              ? `${fmt(row.basal)} kcal · somente basal`
                              : "Não informado"}
                        </td>
                        <td data-label="Consumo">
                          {row.consumed === null
                            ? "Sem registros"
                            : `${fmt(row.consumed)} kcal`}
                          {row.consumed !== null && (
                            <small className="energy-source">
                              {row.foodConfirmed
                                ? "Alimentação confirmada"
                                : "Registro em andamento"}
                            </small>
                          )}
                        </td>
                        <td
                          data-label="Saldo"
                          className={
                            (row.balance ?? 0) > 0 ? "calorie-excess-text" : ""
                          }
                        >
                          {!row.foodConfirmed && row.consumed !== null
                            ? "Confirme a alimentação"
                            : row.balance !== null
                              ? `${signed(row.balance)} kcal`
                              : row.basalBalance !== null
                                ? `${signed(row.basalBalance)} kcal vs. basal`
                                : "Sem comparação"}
                          <small className="energy-source">
                            {!row.foodConfirmed || !row.closed
                              ? "Parcial"
                              : row.balance === null
                                ? ""
                                : row.balance < 0
                                  ? "Déficit"
                                  : row.balance > 0
                                    ? "Superávit"
                                    : "Equilíbrio"}
                          </small>
                        </td>
                        <td data-label="Ações">
                          <div className="button-row">
                            {row.entry && (
                              <>
                                <IconButton
                                  label={
                                    "Editar gasto de " + dateLabel(row.date)
                                  }
                                  onClick={() => setEditing(row.entry!)}
                                >
                                  <Pencil size={15} />
                                </IconButton>
                                <IconButton
                                  label={
                                    "Excluir gasto de " + dateLabel(row.date)
                                  }
                                  onClick={() => remove(row.entry!)}
                                >
                                  <Trash2 size={15} />
                                </IconButton>
                              </>
                            )}
                            <IconButton
                              label={
                                "Ver alimentação de " + dateLabel(row.date)
                              }
                              onClick={() => onOpenDiary("/?date=" + row.date)}
                            >
                              <ArrowRight size={15} />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
      {preview && (
        <Modal
          title="Revisar importação simulada"
          subtitle="Estes dados são exemplos fictícios. Só serão salvos após sua confirmação."
          onClose={() => {
            if (!task.busy) {
              setPreview(null);
              task.setError("");
            }
          }}
          wide
        >
          <div className="info-box">
            {replaced} datas já possuem registros e serão substituídas
            integralmente pelos valores abaixo. Não haverá soma entre fontes.
            {preview.some((e) => e.totalCalories === null)
              ? " Este exemplo não informa gasto total; essas datas ficarão sem balanço até você completá-lo."
              : ""}
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Atividade</th>
                  <th>Gasto total</th>
                  <th>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((entry) => (
                  <tr key={entry.date}>
                    <td data-label="Data">
                      {dateLabel(entry.date)}
                      {entry.date === today() ? " · parcial" : ""}
                    </td>
                    <td data-label="Atividade">
                      {fmt(entry.activeCalories)} kcal
                    </td>
                    <td data-label="Total">
                      {entry.totalCalories === null
                        ? "Não informado"
                        : `${fmt(entry.totalCalories)} kcal`}
                    </td>
                    <td data-label="Tempo">{entry.minutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ErrorBox message={task.error} />
          <div className="form-actions">
            <Button
              variant="secondary"
              disabled={task.busy}
              onClick={() => setPreview(null)}
            >
              Cancelar
            </Button>
            <Button loading={task.busy} onClick={() => void confirmImport()}>
              Confirmar importação
            </Button>
          </div>
        </Modal>
      )}
      {basalOpen && <BasalEditor onClose={() => setBasalOpen(false)} />}
      {editing && (
        <EnergyEditor
          entry={editing === "new" ? undefined : editing}
          date={anchor > today() ? today() : anchor}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EnergyEditor({
  entry,
  date,
  onClose,
}: {
  entry?: EnergyEntry;
  date: string;
  onClose: () => void;
}) {
  const { update, notify } = useApp();
  const [draft, setDraft] = useState<EnergyEntry>(
    entry ?? {
      id: uid(),
      date,
      activeCalories: 0,
      totalCalories: 0,
      minutes: 0,
      source: "manual",
      simulated: false,
      updatedAt: "",
    },
  );
  const [hasTotal, setHasTotal] = useState(
    entry ? entry.totalCalories !== null : true,
  );
  const task = useFormTask();
  const save = () =>
    task.run(async () => {
      const next = {
        ...draft,
        totalCalories: hasTotal ? draft.totalCalories : null,
        source: "manual" as const,
        updatedAt: new Date().toISOString(),
      };
      validateEnergy(next);
      await update((d) => {
        if (d.energy.some((e) => e.date === next.date && e.id !== next.id))
          throw new Error(
            "Já existe gasto nesta data. Edite o registro existente ou escolha outro dia.",
          );
        return {
          ...d,
          energy: mergeEnergy(
            d.energy.filter((e) => e.id !== next.id),
            [next],
          ),
        };
      });
      notify("Gasto salvo. Balanço atualizado.");
      onClose();
    });
  return (
    <Modal
      title={entry ? "Editar gasto de energia" : "Registrar gasto de energia"}
      subtitle="Informe o resumo diário, com o gasto total que já inclui repouso e atividade."
      onClose={() => {
        if (!task.busy) onClose();
      }}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Data do gasto">
          <DateInput
            required
            max={today()}
            value={draft.date}
            onValueChange={(value) => setDraft({ ...draft, date: value })}
          />
        </Field>
        <div className="form-grid">
          <NumberField
            label="Calorias de atividade"
            value={draft.activeCalories}
            suffix="kcal"
            onChange={(activeCalories) =>
              setDraft({ ...draft, activeCalories })
            }
          />
          <NumberField
            label="Tempo de atividade"
            value={draft.minutes}
            suffix="min"
            max={1440}
            onChange={(minutes) => setDraft({ ...draft, minutes })}
          />
        </div>
        <label className="energy-checkbox">
          <input
            type="checkbox"
            checked={hasTotal}
            onChange={(e) => {
              setHasTotal(e.target.checked);
              if (e.target.checked && draft.totalCalories === null)
                setDraft({ ...draft, totalCalories: 0 });
            }}
          />
          Tenho o gasto total diário
        </label>
        {hasTotal ? (
          <NumberField
            label="Gasto total diário"
            value={draft.totalCalories ?? 0}
            min={Math.max(1, draft.activeCalories)}
            blankZero
            suffix="kcal"
            onChange={(totalCalories) => setDraft({ ...draft, totalCalories })}
          />
        ) : (
          <div className="info-box">
            As calorias de atividade ficam registradas. O balanço aguarda o
            gasto total diário; não estimamos o repouso automaticamente.
          </div>
        )}
        {draft.date === today() && (
          <p className="muted small">
            Hoje é parcial e não entra no déficit ou superávit acumulado.
          </p>
        )}
        <ErrorBox message={task.error} />
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={task.busy}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <SaveButton busy={task.busy}>Salvar gasto</SaveButton>
        </div>
      </form>
    </Modal>
  );
}

function BasalEditor({ onClose }: { onClose: () => void }) {
  const data = useData();
  const { update, notify } = useApp();
  const [profile, setProfile] = useState(data.profile);
  const task = useFormTask();
  return (
    <Modal
      title="Configurar metabolismo basal"
      subtitle="A mesma configuração fica disponível em Perfil → Dados pessoais."
      onClose={() => {
        if (!task.busy) onClose();
      }}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await update((d) =>
              withBasalProfile(d, {
                ...d.profile,
                basalMode: profile.basalMode,
                basalManualCalories: profile.basalManualCalories,
              }),
            );
            notify("Referência basal salva a partir de hoje.");
            onClose();
          });
        }}
      >
        <BasalFields profile={profile} onChange={setProfile} />
        <ErrorBox message={task.error} />
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={task.busy}
          >
            Cancelar
          </Button>
          <SaveButton busy={task.busy}>Salvar referência basal</SaveButton>
        </div>
      </form>
    </Modal>
  );
}
