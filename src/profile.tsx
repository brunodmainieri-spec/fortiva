import { InstallAppCard } from "./pwa";
import { BasalFields, withBasalProfile } from "./basal";
import "./profile-ux.css";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  LogOut,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { auth } from "./services";
import { useApp, useData } from "./store";
import {
  calculateGoals,
  fmt,
  GOAL_LABELS,
  goalAt,
  lengthDisplay,
  lengthInternal,
  lengthUnit,
  macroEnergy,
  today,
  uid,
  weightDisplay,
  weightInternal,
  weightUnit,
} from "./domain";
import type { Macros, Profile } from "./domain";
import {
  Button,
  ErrorBox,
  Field,
  IconButton,
  Logo,
  NumberField,
  PageTitle,
  SaveButton,
  Segmented,
  useFormTask,
} from "./ui";

export function AuthPage() {
  const { data, enter, startupError } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register" | "recover">("login");
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recovered, setRecovered] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const task = useFormTask();
  if (data)
    return (
      <Navigate to={data.profile.onboarded ? "/" : "/onboarding"} replace />
    );
  const submit = () =>
    task.run(async () => {
      if (mode === "recover") {
        await auth.recover(email);
        setRecovered(true);
        return;
      }
      const next =
        mode === "login"
          ? await auth.signIn(email, password)
          : await auth.register(name, email, password);
      if (!next) {
        setConfirmation(true);
        return;
      }
      enter(next);
      navigate(next.profile.onboarded ? "/" : "/onboarding");
    });
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Logo />
        <div className="auth-story-content">
          <div className="pill">
            <span className="live-dot" /> SEU PRÓXIMO CAPÍTULO COMEÇA AQUI
          </div>
          <h1>
            Sua melhor
            <br />
            versão.
            <br />
            <em>Todo dia.</em>
          </h1>
          <p>
            Alimentação, treino e evolução.
            <br />
            Conectados ao que mais importa: você.
          </p>
          <div className="auth-orbit">
            <div className="orbit-circle o1" />
            <div className="orbit-circle o2" />
            <div className="orbit-circle o3" />
            <span className="orbit-center">
              <TrendingUp size={62} strokeWidth={1.3} />
            </span>
            <div className="floating-mini float-one">
              <span className="mini-icon">
                <Flame size={19} />
              </span>
              <div>
                <small>Mais equilíbrio</small>
                <strong>Uma escolha por vez</strong>
              </div>
              <Check size={16} />
            </div>
            <div className="floating-mini float-two">
              <span className="mini-icon purple">
                <Dumbbell size={19} />
              </span>
              <div>
                <small>Mais constância</small>
                <strong>Seu ritmo. Sua evolução.</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="auth-story-footer">
          <span>MENOS COMPLICAÇÃO. MAIS MOVIMENTO.</span>
          <ArrowUpRight size={19} />
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        <div className="auth-form-box">
          <div className="eyebrow">BEM-VINDO AO SEU NOVO RITMO</div>
          <h2>
            {mode === "login"
              ? "Bom ter você aqui."
              : mode === "register"
                ? "Vamos começar?"
                : "Recupere seu acesso."}
          </h2>
          <p>
            {mode === "login"
              ? "Entre para continuar cuidando de você."
              : mode === "register"
                ? "Crie seu acesso e depois personalize seus dados, metas e rotina."
                : "Informe seu e-mail para receber o link de recuperação."}
          </p>
          {mode !== "recover" && (
            <Segmented
              label="Tipo de acesso"
              value={mode}
              onChange={(v) => {
                setMode(v);
                task.setError("");
              }}
              options={[
                { value: "login", label: "Entrar" },
                { value: "register", label: "Criar conta" },
              ]}
            />
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="form-stack"
          >
            {mode === "register" && (
              <Field label="Seu nome">
                <input
                  autoComplete="name"
                  placeholder="Como podemos te chamar?"
                  value={name}
                  minLength={2}
                  maxLength={60}
                  required
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            )}
            <Field label="E-mail">
              <input
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {mode !== "recover" && (
              <Field label="Senha">
                <div className="password-input">
                  <input
                    type={show ? "text" : "password"}
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    placeholder="Pelo menos 6 caracteres"
                    minLength={6}
                    value={password}
                    required
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <IconButton
                    type="button"
                    label={show ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </IconButton>
                </div>
              </Field>
            )}
            {mode === "login" && (
              <button
                type="button"
                className="forgot-link"
                onClick={() => {
                  setMode("recover");
                  task.setError("");
                }}
              >
                Esqueci minha senha
              </button>
            )}
            <ErrorBox message={task.error || startupError} />
            {confirmation && mode === "register" && (
              <div className="success-box" role="status">
                Confira seu e-mail para confirmar o cadastro. Depois, entre com
                sua senha.
              </div>
            )}
            {recovered && mode === "recover" && (
              <div className="success-box" role="status">
                Se existir uma conta com este e-mail, você receberá um link para
                redefinir sua senha.
              </div>
            )}
            <Button type="submit" loading={task.busy}>
              {mode === "login"
                ? "Entrar na minha conta"
                : mode === "register"
                  ? "Criar minha conta"
                  : "Enviar link de recuperação"}
              <ArrowRight size={18} />
            </Button>
          </form>
          {mode === "recover" && (
            <button
              className="text-link back-login"
              onClick={() => {
                setMode("login");
                setRecovered(false);
              }}
            >
              <ChevronLeft size={16} />
              Voltar para entrar
            </button>
          )}
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              Seus registros são salvos na sua conta e ficam disponíveis ao
              entrar em outro dispositivo.
            </span>
          </div>
        </div>
        <span className="auth-copyright">
          © {new Date().getFullYear()} FORTIVA · Evolua no seu ritmo.
        </span>
      </section>
    </div>
  );
}
export function PersonalFields({
  profile: p,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const patch = (values: Partial<Profile>) => onChange({ ...p, ...values });
  return (
    <>
      <Field label="Nome">
        <input
          value={p.name}
          required
          minLength={2}
          maxLength={60}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>
      <div className="form-grid">
        <NumberField
          label="Idade"
          value={p.age}
          blankZero={!p.onboarded}
          min={1}
          max={120}
          step={1}
          suffix="anos"
          onChange={(age) => patch({ age })}
        />
        <NumberField
          label="Altura"
          value={lengthDisplay(p.height, p.units)}
          blankZero={!p.onboarded}
          min={1}
          suffix={lengthUnit(p)}
          onChange={(v) => patch({ height: lengthInternal(v, p.units) })}
        />
        <NumberField
          label="Peso atual"
          value={weightDisplay(p.weight, p.units)}
          blankZero={!p.onboarded}
          min={1}
          suffix={weightUnit(p)}
          onChange={(v) => patch({ weight: weightInternal(v, p.units) })}
        />
        <Field
          label="Coeficiente para o cálculo"
          hint="Usado apenas na equação de gasto energético."
        >
          <select
            value={p.coefficient}
            onChange={(e) =>
              patch({ coefficient: e.target.value as Profile["coefficient"] })
            }
          >
            <option value="male">Masculino (+5)</option>
            <option value="female">Feminino (−161)</option>
            <option value="manual">Prefiro metas manuais</option>
          </select>
        </Field>
      </div>
    </>
  );
}
export function ObjectiveFields({
  profile: p,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const patch = (values: Partial<Profile>) => onChange({ ...p, ...values });
  return (
    <>
      <Field label="Seu objetivo">
        <select
          value={p.goal}
          onChange={(e) => patch({ goal: e.target.value as Profile["goal"] })}
        >
          {Object.entries(GOAL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <NumberField
          label="Peso desejado"
          value={weightDisplay(p.targetWeight, p.units)}
          blankZero={!p.onboarded}
          min={1}
          suffix={weightUnit(p)}
          onChange={(v) => patch({ targetWeight: weightInternal(v, p.units) })}
        />
        <Field
          label="Atividade no dia a dia"
          hint="Considere sua rotina completa, incluindo deslocamentos, trabalho e exercícios."
        >
          <select
            value={p.activity}
            onChange={(e) => patch({ activity: Number(e.target.value) })}
          >
            <option value={1.2}>Sedentário · maior parte do dia sentado</option>
            <option value={1.375}>
              Levemente ativo · caminhadas e movimento leve
            </option>
            <option value={1.55}>
              Moderadamente ativo · exercícios regulares
            </option>
            <option value={1.725}>
              Muito ativo · rotina e exercícios intensos
            </option>
            <option value={1.9}>
              Extremamente ativo · trabalho físico e treino intenso
            </option>
          </select>
        </Field>
        <div className="optional-measure">
          <NumberField
            label="Meta de cintura"
            value={lengthDisplay(p.targetWaist, p.units)}
            suffix={lengthUnit(p)}
            blankZero
            required={false}
            min={1}
            onChange={(v) => patch({ targetWaist: lengthInternal(v, p.units) })}
          />
          <button
            type="button"
            className="optional-measure-skip"
            onClick={() => patch({ targetWaist: 0 })}
          >
            Definir depois <span className="sr-only">a meta de cintura</span>
          </button>
        </div>
        <div className="optional-measure">
          <NumberField
            label="Meta de braço"
            value={lengthDisplay(p.targetArm, p.units)}
            suffix={lengthUnit(p)}
            blankZero
            required={false}
            min={1}
            onChange={(v) => patch({ targetArm: lengthInternal(v, p.units) })}
          />
          <button
            type="button"
            className="optional-measure-skip"
            onClick={() => patch({ targetArm: 0 })}
          >
            Definir depois <span className="sr-only">a meta de braço</span>
          </button>
        </div>
      </div>
      <p className="profile-ux-hint">
        Cintura e braço são opcionais. Você pode definir essas metas mais tarde
        no perfil.
      </p>
    </>
  );
}
export function TrainingFields({
  profile: p,
  onChange,
  allowNoTraining = true,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  allowNoTraining?: boolean;
}) {
  const [training, setTraining] = useState(p.frequency > 0);
  const patch = (values: Partial<Profile>) => onChange({ ...p, ...values });
  return (
    <>
      {allowNoTraining && (
        <Field label="Sua rotina de treino">
          <select
            value={training ? "training" : "none"}
            onChange={(e) => {
              setTraining(e.target.value === "training");
              patch(
                e.target.value === "none"
                  ? { frequency: 0, minutes: 0, months: 0 }
                  : { frequency: p.frequency || 3, minutes: p.minutes || 45 },
              );
            }}
          >
            <option value="none">Ainda não treino</option>
            <option value="training">Já treino ou quero começar</option>
          </select>
        </Field>
      )}
      {allowNoTraining && !training ? (
        <p className="profile-ux-hint">
          Tudo bem começar pela alimentação. Você pode definir uma rotina e
          criar seu primeiro plano quando quiser.
        </p>
      ) : (
        <div className="form-grid">
          <Field label="Experiência">
            <select
              value={p.experience}
              onChange={(e) =>
                patch({ experience: e.target.value as Profile["experience"] })
              }
            >
              <option value="beginner">Iniciante</option>
              <option value="intermediate">Intermediário</option>
              <option value="advanced">Avançado</option>
            </select>
          </Field>
          <NumberField
            label="Tempo de prática"
            value={p.months}
            min={0}
            max={1000}
            step={1}
            suffix="meses"
            onChange={(months) => patch({ months })}
          />
          <NumberField
            label="Dias por semana"
            value={p.frequency}
            blankZero={!p.onboarded}
            min={1}
            max={7}
            step={1}
            suffix="dias"
            onChange={(frequency) => patch({ frequency })}
          />
          <NumberField
            label="Tempo por treino"
            value={p.minutes}
            blankZero={!p.onboarded}
            min={15}
            max={180}
            step={5}
            suffix="min"
            onChange={(minutes) => patch({ minutes })}
          />
        </div>
      )}
    </>
  );
}
export function NutritionFields({
  profile,
  macros,
  onChange,
  onCalculate,
}: {
  profile: Profile;
  macros: Macros;
  onChange: (m: Macros) => void;
  onCalculate: () => void;
}) {
  const diff = Math.abs(macroEnergy(macros) - macros.calories);
  return (
    <>
      <div className="subheading">
        <div>
          <h3>Sua meta diária</h3>
          <p>Um ponto de partida que você pode ajustar.</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={onCalculate}
          disabled={profile.coefficient === "manual" || profile.age < 18}
        >
          <Sparkles size={16} />
          Sugerir metas
        </Button>
      </div>
      <div className="form-grid">
        <NumberField
          label="Calorias"
          value={macros.calories}
          blankZero={!profile.onboarded}
          min={1}
          suffix="kcal"
          onChange={(calories) => onChange({ ...macros, calories })}
        />
        <NumberField
          label="Proteínas"
          value={macros.protein}
          suffix="g"
          onChange={(protein) => onChange({ ...macros, protein })}
        />
        <NumberField
          label="Carboidratos"
          value={macros.carbs}
          suffix="g"
          onChange={(carbs) => onChange({ ...macros, carbs })}
        />
        <NumberField
          label="Gorduras"
          value={macros.fat}
          suffix="g"
          onChange={(fat) => onChange({ ...macros, fat })}
        />
      </div>
      {diff > 15 && (
        <div className="info-box">
          Os macros equivalem a {fmt(macroEnergy(macros))} kcal; a meta
          informada é {fmt(macros.calories)} kcal. Você pode ajustar os valores
          ou manter metas independentes.
        </div>
      )}
      <details className="formula-details">
        <summary>Como calculamos a sugestão?</summary>
        <p>
          Estimativa para adultos: Mifflin–St Jeor = 10 × peso (kg) + 6,25 ×
          altura (cm) − 5 × idade + coeficiente (+5 ou −161). Multiplicamos pela
          atividade ({profile.activity}) e pelo objetivo: −10% no cutting, sem
          ajuste na manutenção, +10% no bulking.
        </p>
        <p>
          Proteína: 1,6 g/kg. Gordura: 25% das calorias. Carboidratos: calorias
          restantes. Fatores energéticos: 4, 4 e 9 kcal/g. São padrões editáveis
          do protótipo, não uma prescrição individual.
        </p>
        <a
          href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
          target="_blank"
          rel="noreferrer"
        >
          Estudo da equação
        </a>
        <span> · </span>
        <a
          href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/"
          target="_blank"
          rel="noreferrer"
        >
          Referência sobre proteínas
        </a>
      </details>
      {(profile.age < 18 || profile.coefficient === "manual") && (
        <p className="muted small">
          Preencha as metas manualmente. O cálculo automático é destinado a
          adultos que selecionaram um coeficiente.
        </p>
      )}
    </>
  );
}
export function Onboarding() {
  const data = useData();
  const { update, notify, logout } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(data.onboarding?.step ?? 0);
  const [profile, setProfile] = useState(data.profile);
  const [macros, setMacros] = useState<Macros>(
    data.onboarding?.macros ?? {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    },
  );
  const [calculatedFor, setCalculatedFor] = useState(
    data.onboarding?.calculatedFor ?? "",
  );
  const task = useFormTask();
  const signature = JSON.stringify([
    profile.age,
    profile.height,
    profile.weight,
    profile.coefficient,
    profile.activity,
    profile.goal,
  ]);
  if (data.profile.onboarded) return <Navigate to="/" replace />;
  const calculate = () => {
    try {
      setMacros(calculateGoals(profile));
      setCalculatedFor(signature);
      task.setError("");
    } catch (e) {
      task.setError((e as Error).message);
    }
  };
  const saveStep = async (
    nextStep: number,
    nextMacros = macros,
    nextSignature = calculatedFor,
  ) => {
    await update((d) => ({
      ...d,
      profile: { ...profile, onboarded: false },
      onboarding: {
        step: nextStep,
        macros: nextMacros,
        calculatedFor: nextSignature,
      },
    }));
    setMacros(nextMacros);
    setCalculatedFor(nextSignature);
    setStep(nextStep);
  };
  const submit = () =>
    task.run(async () => {
      if (step < 3) {
        let nextMacros = macros;
        let nextSignature = calculatedFor;
        if (step === 2 && signature !== calculatedFor) {
          nextMacros =
            profile.age >= 18 && profile.coefficient !== "manual"
              ? calculateGoals(profile)
              : { calories: 0, protein: 0, carbs: 0, fat: 0 };
          nextSignature = signature;
        }
        await saveStep(step + 1, nextMacros, nextSignature);
        return;
      }
      await update((d) => ({
        ...d,
        onboarding: undefined,
        profile: { ...profile, name: profile.name.trim(), onboarded: true },
        goals: [{ ...macros, date: today(), frequency: profile.frequency }],
        measurements: [
          {
            id: uid(),
            date: today(),
            weight: profile.weight,
            waist: 0,
            arm: 0,
          },
        ],
      }));
      notify("Seu espaço está pronto. Vamos nessa!");
      navigate("/", { replace: true });
    });
  return (
    <div className="onboarding-page">
      <Logo />
      <div className="onboarding-card card">
        <div className="stepper" aria-label="Etapas do primeiro acesso">
          {["Você", "Objetivo", "Rotina", "Metas"].map((s, i) => (
            <div
              key={s}
              className={i <= step ? "active" : ""}
              aria-current={i === step ? "step" : undefined}
            >
              <span>{i < step ? <Check size={15} /> : i + 1}</span>
              <small>{s}</small>
            </div>
          ))}
        </div>
        <div className="eyebrow">PASSO {step + 1} DE 4</div>
        <h1>
          {
            [
              "Vamos nos conhecer.",
              "O que te move?",
              "Como é sua rotina?",
              "Um plano para começar.",
            ][step]
          }
        </h1>
        <p className="muted">
          {
            [
              "Antes de começar, preencha seus dados para personalizar seu acompanhamento.",
              "Defina seu objetivo e o peso desejado. As metas de medidas são opcionais.",
              "Conte sua experiência e quanto tempo pode dedicar aos treinos.",
              "Revise suas metas diárias e ajuste os valores antes de entrar no diário.",
            ][step]
          }
        </p>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {step === 0 && (
            <PersonalFields profile={profile} onChange={setProfile} />
          )}
          {step === 1 && (
            <ObjectiveFields profile={profile} onChange={setProfile} />
          )}
          {step === 2 && (
            <TrainingFields profile={profile} onChange={setProfile} />
          )}
          {step === 3 && (
            <>
              <div className="info-box">
                {profile.name.split(" ")[0]}, seu objetivo é{" "}
                {GOAL_LABELS[profile.goal].toLowerCase()}: de{" "}
                {fmt(weightDisplay(profile.weight, profile.units), 1)} para{" "}
                {fmt(weightDisplay(profile.targetWeight, profile.units), 1)}{" "}
                {weightUnit(profile)}.{" "}
                {profile.frequency === 0
                  ? "Você pode começar pela alimentação e definir sua rotina de treino depois."
                  : `Sua rotina terá ${profile.frequency} dias de treino por semana, com ${profile.minutes} minutos por treino.`}
              </div>
              <NutritionFields
                profile={profile}
                macros={macros}
                onChange={setMacros}
                onCalculate={calculate}
              />
            </>
          )}
          <ErrorBox message={task.error} />
          <div className="form-actions">
            {step > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={task.busy}
                onClick={() => void task.run(() => saveStep(step - 1))}
              >
                <ChevronLeft size={17} />
                Voltar
              </Button>
            )}
            <Button type="submit" loading={task.busy}>
              {step === 3 ? "Começar minha jornada" : "Continuar"}
              <ArrowRight size={17} />
            </Button>
          </div>
          <p className="muted small">
            Cada etapa é salva ao continuar. Você pode ajustar tudo depois no
            perfil.
          </p>
          <Button
            type="button"
            variant="ghost"
            disabled={task.busy}
            onClick={() => {
              logout();
              navigate("/entrar");
            }}
          >
            Sair e continuar depois
          </Button>
        </form>
      </div>
    </div>
  );
}
export function ProfilePage() {
  const data = useData();
  const { update, notify, logout } = useApp();
  const [profile, setProfile] = useState({ ...data.profile });
  const [macros, setMacros] = useState<Macros>(
    goalAt(data, today()) ?? {
      calories: 2200,
      protein: 140,
      carbs: 253,
      fat: 70,
    },
  );
  const [tab, setTab] = useState<"profile" | "goals" | "settings">("profile");
  const task = useFormTask();
  const save = () =>
    task.run(async () => {
      await update((d) => ({
        ...withBasalProfile(d, profile),
        goals: [
          ...d.goals.filter((g) => g.date !== today()),
          { ...macros, date: today(), frequency: profile.frequency },
        ],
      }));
      notify("Perfil e metas atualizados.");
    });
  return (
    <>
      <PageTitle title="Seu perfil" />
      <div className="profile-layout">
        <aside className="card profile-summary">
          <div className="profile-avatar">{profile.name.slice(0, 1)}</div>
          <h2>{profile.name}</h2>
          <p>{profile.email}</p>
          <span className="pill">
            <Target size={13} />
            {GOAL_LABELS[profile.goal]}
          </span>
          <div className="profile-stats">
            <div>
              <strong>
                {fmt(weightDisplay(profile.weight, profile.units), 1)}
                <small>{weightUnit(profile)}</small>
              </strong>
              <span>Peso atual</span>
            </div>
            <div>
              <strong>
                {fmt(weightDisplay(profile.targetWeight, profile.units), 1)}
                <small>{weightUnit(profile)}</small>
              </strong>
              <span>Objetivo</span>
            </div>
          </div>
          <div className="profile-menu">
            {[
              { id: "profile", label: "Dados pessoais", icon: UserRound },
              { id: "goals", label: "Metas e rotina", icon: Target },
              { id: "settings", label: "Preferências", icon: ShieldCheck },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id as typeof tab)}
              >
                <Icon size={18} />
                {label}
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </aside>
        <form
          className="card profile-form form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {tab === "profile" && (
            <>
              <div className="subheading">
                <div>
                  <h2>Um pouco sobre você</h2>
                  <p>Mantenha suas informações atualizadas.</p>
                </div>
                <UserRound size={22} />
              </div>
              <PersonalFields profile={profile} onChange={setProfile} />
              <BasalFields profile={profile} onChange={setProfile} />
              <Field
                label="E-mail do perfil"
                hint="E-mail usado para acessar sua conta."
              >
                <input value={profile.email} readOnly type="email" />
              </Field>
            </>
          )}
          {tab === "goals" && (
            <>
              <ObjectiveFields profile={profile} onChange={setProfile} />
              <hr />
              <TrainingFields profile={profile} onChange={setProfile} />
              <hr />
              <NutritionFields
                profile={profile}
                macros={macros}
                onChange={setMacros}
                onCalculate={() => {
                  try {
                    setMacros(calculateGoals(profile));
                    task.setError("");
                  } catch (e) {
                    task.setError((e as Error).message);
                  }
                }}
              />
              <p className="muted small">
                As novas metas valem a partir de hoje. Seu histórico mantém as
                metas anteriores.
              </p>
            </>
          )}
          {tab === "settings" && (
            <>
              <h2>Preferências</h2>
              <InstallAppCard />
              <Field label="Unidades de medida">
                <select
                  value={profile.units}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      units: e.target.value as Profile["units"],
                    })
                  }
                >
                  <option value="metric">Métrico · kg e cm</option>
                  <option value="imperial">Imperial · lb e polegadas</option>
                </select>
              </Field>
              <div className="info-box">
                <ShieldCheck size={19} />
                <div>
                  <strong>Seus dados ficam na sua conta</strong>
                  <p>
                    Os registros são salvos na nuvem. Você pode acessá-los em
                    outro dispositivo entrando com o mesmo e-mail.
                  </p>
                </div>
              </div>

              <div className="settings-action">
                <div>
                  <h3>Sair da conta</h3>
                  <p>Seus registros permanecem salvos na sua conta.</p>
                </div>
                <Button type="button" variant="ghost" onClick={logout}>
                  <LogOut size={16} />
                  Sair
                </Button>
              </div>
            </>
          )}
          <ErrorBox message={task.error} />
          <div className="form-actions">
            <SaveButton busy={task.busy} />
          </div>
        </form>
      </div>
    </>
  );
}

export function ResetPasswordPage() {
  const { finishRecovery } = useApp();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const task = useFormTask();
  return (
    <main className="onboarding-page">
      <div
        className="card form-stack"
        style={{ maxWidth: 480, margin: "64px auto", padding: 32 }}
      >
        <Logo />
        <h1>Crie uma nova senha</h1>
        <p>Abra o link recebido por e-mail para redefinir sua senha.</p>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              if (password !== confirmation)
                throw new Error("As senhas precisam ser iguais.");
              await auth.updatePassword(password);
              await auth.signOut();
              finishRecovery();
              navigate("/entrar", { replace: true });
            });
          }}
        >
          <Field label="Nova senha">
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirme a nova senha">
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </Field>
          <ErrorBox message={task.error} />
          <Button type="submit" loading={task.busy}>
            Salvar nova senha
          </Button>
        </form>
        <Button
          variant="ghost"
          onClick={() => {
            finishRecovery();
            navigate("/entrar");
          }}
        >
          Voltar
        </Button>
      </div>
    </main>
  );
}
