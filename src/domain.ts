export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type Goal = "cutting" | "maintenance" | "bulking";
export type Profile = {
  name: string;
  email: string;
  age: number;
  height: number;
  weight: number;
  targetWeight: number;
  targetWaist: number;
  targetArm: number;
  coefficient: "male" | "female" | "manual";
  goal: Goal;
  activity: number;
  experience: "beginner" | "intermediate" | "advanced";
  months: number;
  minutes: number;
  frequency: number;
  units: "metric" | "imperial";
  onboarded: boolean;
  basalMode?: "off" | "automatic" | "manual";
  basalManualCalories?: number;
};
export type GoalSnapshot = Macros & { date: string; frequency: number };
export type FoodItem = Macros & {
  id: string;
  name: string;
  portion: number;
  unit: string;
  photo?: string;
};
export type Meal = {
  id: string;
  date: string;
  time: string;
  type: string;
  items: FoodItem[];
};
export type Measurement = {
  id: string;
  date: string;
  weight: number;
  waist: number;
  arm: number;
  photo?: string;
};
export type Exercise = { id: string; name: string; muscle: string };
export type Prescription = {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  rest: number;
};
export type PlanDay = { id: string; name: string; exercises: Prescription[] };
export type Plan = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  updatedAt: string;
  days: PlanDay[];
  revisions: { at: string; days: PlanDay[] }[];
};
export type WorkoutSet = {
  id: string;
  reps: number;
  weight: number;
  done: boolean;
};
export type SessionExercise = {
  id: string;
  exerciseId: string;
  name: string;
  rest: number;
  sets: WorkoutSet[];
};
export type Session = {
  id: string;
  name: string;
  planId?: string;
  date: string;
  startedAt: string;
  finishedAt?: string;
  duration: number;
  exercises: SessionExercise[];
};
export type EnergyProvider = "strava" | "garmin" | "watch";
export type EnergyEntry = {
  id: string;
  date: string;
  activeCalories: number;
  totalCalories: number | null;
  minutes: number;
  source: EnergyProvider | "manual";
  simulated: boolean;
  updatedAt: string;
};
export type MealDraft = {
  meal: Meal;
  originalId?: string;
  mode: "manual" | "photo" | "quick";
  photo: string;
  analyzed: boolean;
  analysisNote?: string;
  saveTemplate?: boolean;
  templateName?: string;
};
export type SavedMeal = { id: string; name: string; items: FoodItem[] };
export type AppData = {
  confirmedFoodDays?: string[];
  favoriteFoods?: FoodItem[];
  savedMeals?: SavedMeal[];
  mealDrafts?: Record<string, MealDraft>;
  planDraft?: { plan: Plan; originalId?: string };
  basalHistory?: {
    date: string;
    calories: number | null;
    method: "off" | "automatic" | "manual";
  }[];
  energy: EnergyEntry[];
  energyConnection?: {
    provider: EnergyProvider;
    connectedAt: string;
    syncedAt?: string;
  };
  version: 1;
  onboarding?: { step: number; macros: Macros; calculatedFor: string };
  profile: Profile;
  goals: GoalSnapshot[];
  meals: Meal[];
  measurements: Measurement[];
  plans: Plan[];
  sessions: Session[];
};
export const uid = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Access by phone over local HTTP may not expose randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
export const localDate = (date = new Date()) =>
  String(date.getFullYear()) +
  "-" +
  String(date.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(date.getDate()).padStart(2, "0");
export const shiftDate = (date: string, days: number) => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return localDate(d);
};
export const today = () => localDate();
export const fmt = (n: number, digits = 0) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(n);
export const dateLabel = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) => new Date(date + "T12:00:00").toLocaleDateString("pt-BR", options);
export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
export const MEAL_TYPES = [
  "Café da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
];
export const GOAL_LABELS = {
  cutting: "Emagrecer",
  maintenance: "Manter o peso",
  bulking: "Ganhar massa",
};
export const MACRO_LABELS = {
  calories: "Calorias",
  protein: "Proteínas",
  carbs: "Carboidratos",
  fat: "Gorduras",
};
export const sumMacros = (items: Macros[]): Macros =>
  items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { ...ZERO },
  );
export const dayMacros = (data: AppData, date: string) =>
  sumMacros(data.meals.filter((m) => m.date === date).flatMap((m) => m.items));
export const goalAt = (data: AppData, date: string) =>
  [...data.goals]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((g) => g.date <= date) ?? null;
export const calculateBasal = (p: Profile): number => {
  if (!Number.isFinite(p.age) || p.age < 18 || p.coefficient === "manual")
    throw new Error(
      "Para o cálculo automático de repouso, informe idade adulta e um coeficiente nos dados pessoais, ou use um valor manual.",
    );
  if (![p.weight, p.height].every((n) => Number.isFinite(n) && n > 0))
    throw new Error("Confira peso e altura para calcular o metabolismo basal.");
  const basal =
    10 * p.weight +
    6.25 * p.height -
    5 * p.age +
    (p.coefficient === "male" ? 5 : -161);
  if (basal <= 0)
    throw new Error("Os dados não permitem uma estimativa de repouso válida.");
  return basal;
};
export const calculateGoals = (p: Profile): Macros => {
  if (p.age < 18 || p.coefficient === "manual")
    throw new Error("Use metas manuais para este perfil.");
  if (!Number.isFinite(p.activity) || p.activity <= 0)
    throw new Error("Confira a atividade física.");
  const basal = calculateBasal(p);
  const calories = Math.round(
    basal *
      p.activity *
      (p.goal === "cutting" ? 0.9 : p.goal === "bulking" ? 1.1 : 1),
  );
  const protein = Math.round(p.weight * 1.6);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  if (calories <= 0 || carbs < 0)
    throw new Error(
      "Esses dados não permitem uma sugestão coerente. Revise-os ou use metas manuais.",
    );
  return { calories, protein, carbs, fat };
};
export const macroEnergy = (m: Macros) =>
  m.protein * 4 + m.carbs * 4 + m.fat * 9;
export const scaleItem = (item: FoodItem, portion: number): FoodItem => {
  if (item.portion <= 0 || portion <= 0) return item;
  const ratio = portion / item.portion;
  return {
    ...item,
    portion,
    calories: item.calories * ratio,
    protein: item.protein * ratio,
    carbs: item.carbs * ratio,
    fat: item.fat * ratio,
  };
};
export const periodDates = (
  anchor: string,
  period: "day" | "week" | "month",
) => {
  const d = new Date(anchor + "T12:00:00");
  let first = anchor;
  let last = anchor;
  if (period === "week") {
    first = shiftDate(anchor, -((d.getDay() + 6) % 7));
    last = shiftDate(first, 6);
  }
  if (period === "month") {
    first = localDate(new Date(d.getFullYear(), d.getMonth(), 1));
    last = localDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }
  const result: string[] = [];
  for (let cursor = first; cursor <= last; cursor = shiftDate(cursor, 1))
    result.push(cursor);
  return result;
};
export const calorieBalance = (calories: number, goal: number | null) => ({
  withinGoal: goal === null ? calories : Math.min(calories, goal),
  excess: goal === null ? 0 : Math.max(0, calories - goal),
  below: goal === null ? null : Math.max(0, goal - calories),
});
export const periodStats = (
  data: AppData,
  dates: string[],
  currentDate = today(),
) => {
  const recorded = dates.filter((date) =>
    data.meals.some((m) => m.date === date && m.items.length),
  );
  const complete = recorded.filter(
    (date) =>
      date < currentDate &&
      goalAt(data, date) &&
      data.confirmedFoodDays?.includes(date),
  );
  const balances = complete.map((date) =>
    calorieBalance(
      dayMacros(data, date).calories,
      goalAt(data, date)!.calories,
    ),
  );
  const adherent = complete.filter((date) => {
    const goal = goalAt(data, date)!;
    return (
      Math.abs(dayMacros(data, date).calories - goal.calories) <=
      goal.calories * 0.1
    );
  });
  return {
    recorded: recorded.length,
    confirmed: recorded.filter((d) => data.confirmedFoodDays?.includes(d))
      .length,
    incomplete: recorded.filter((d) => !data.confirmedFoodDays?.includes(d))
      .length,
    total: sumMacros(recorded.map((d) => dayMacros(data, d))),
    excessCalories: balances.reduce((sum, b) => sum + b.excess, 0),
    belowCalories: balances.reduce((sum, b) => sum + (b.below ?? 0), 0),
    daysAbove: balances.filter((b) => b.excess > 0).length,
    daysBelow: balances.filter((b) => (b.below ?? 0) > 0).length,
    denominator: complete.length,
    adherent: adherent.length,
    adherence: complete.length
      ? Math.round((adherent.length / complete.length) * 100)
      : null,
  };
};
export const volume = (s: Session) =>
  s.exercises
    .flatMap((e) => e.sets)
    .filter((s) => s.done)
    .reduce((sum, s) => sum + s.weight * s.reps, 0);
export const weightDisplay = (kg: number, units: Profile["units"]) =>
  units === "imperial" ? kg * 2.2046226218 : kg;
export const weightInternal = (value: number, units: Profile["units"]) =>
  units === "imperial" ? value / 2.2046226218 : value;
export const lengthDisplay = (cm: number, units: Profile["units"]) =>
  units === "imperial" ? cm / 2.54 : cm;
export const lengthInternal = (value: number, units: Profile["units"]) =>
  units === "imperial" ? value * 2.54 : value;
export const weightUnit = (p: Profile) => (p.units === "metric" ? "kg" : "lb");
export const lengthUnit = (p: Profile) => (p.units === "metric" ? "cm" : "pol");
export const exerciseCatalog: Exercise[] = [
  { id: "squat", name: "Agachamento livre", muscle: "Pernas" },
  { id: "bench", name: "Supino reto", muscle: "Peito" },
  { id: "row", name: "Remada baixa", muscle: "Costas" },
  { id: "legpress", name: "Leg press 45°", muscle: "Pernas" },
  { id: "pulldown", name: "Puxada frontal", muscle: "Costas" },
  { id: "shoulder", name: "Desenvolvimento com halteres", muscle: "Ombros" },
  { id: "curl", name: "Rosca direta", muscle: "Bíceps" },
  { id: "triceps", name: "Tríceps na polia", muscle: "Tríceps" },
  { id: "lunge", name: "Afundo", muscle: "Pernas" },
  { id: "deadlift", name: "Levantamento terra", muscle: "Posterior" },
  { id: "crunch", name: "Abdominal", muscle: "Abdômen" },
  { id: "calf", name: "Elevação de panturrilha", muscle: "Pernas" },
];
export const prescription = (index: number, weight = 0): Prescription => ({
  id: uid(),
  exerciseId: exerciseCatalog[index].id,
  name: exerciseCatalog[index].name,
  sets: 3,
  reps: 12,
  weight,
  rest: 60,
});
export const startSession = (
  day: PlanDay,
  planId?: string,
  date = today(),
): Session => ({
  id: uid(),
  name: day.name,
  planId,
  date,
  startedAt: new Date().toISOString(),
  duration: 0,
  exercises: day.exercises.map((e) => ({
    id: uid(),
    exerciseId: e.exerciseId,
    name: e.name,
    rest: e.rest,
    sets: Array.from({ length: e.sets }, () => ({
      id: uid(),
      reps: e.reps,
      weight: e.weight,
      done: false,
    })),
  })),
});
export const initialProfile = (email = ""): Profile => ({
  name: "",
  email,
  age: 28,
  height: 175,
  weight: 82,
  targetWeight: 76,
  targetWaist: 80,
  targetArm: 35,
  coefficient: "male",
  goal: "cutting",
  activity: 1.55,
  experience: "beginner",
  months: 3,
  minutes: 45,
  frequency: 3,
  units: "metric",
  onboarded: false,
});
export const blankData = (email: string, name: string): AppData => ({
  energy: [],
  version: 1,
  profile: {
    ...initialProfile(email),
    name,
    age: 0,
    height: 0,
    weight: 0,
    targetWeight: 0,
    targetWaist: 0,
    targetArm: 0,
    months: 0,
    minutes: 0,
    frequency: 0,
  },
  goals: [],
  meals: [],
  measurements: [],
  plans: [],
  sessions: [],
});
export const food = (
  name: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  portion = 100,
): FoodItem => ({
  id: uid(),
  name,
  calories,
  protein,
  carbs,
  fat,
  portion,
  unit: "g",
});
export const sampleFoods = () => [
  food("Peito de frango grelhado", 248, 46.5, 0, 5.4, 150),
  food("Arroz integral", 124, 2.6, 25.8, 1, 100),
  food("Brócolis no vapor", 28, 2.4, 4.4, 0.4, 80),
];
export const samplePlan = (): Plan => ({
  id: uid(),
  name: "Meu próximo nível",
  description: "Força e constância · Divisão ABC",
  active: true,
  updatedAt: new Date().toISOString(),
  revisions: [],
  days: [
    {
      id: uid(),
      name: "Treino A · Peito e tríceps",
      exercises: [
        prescription(1, 30),
        prescription(5, 12),
        prescription(7, 15),
        prescription(10),
      ],
    },
    {
      id: uid(),
      name: "Treino B · Costas e bíceps",
      exercises: [
        prescription(4, 35),
        prescription(2, 30),
        prescription(6, 12),
        prescription(10),
      ],
    },
    {
      id: uid(),
      name: "Treino C · Pernas completas",
      exercises: [
        prescription(0, 40),
        prescription(3, 100),
        prescription(8, 10),
        prescription(11, 20),
      ],
    },
  ],
});
export const sampleEnergy = (anchor = today(), days = 90): EnergyEntry[] =>
  Array.from({ length: days }, (_, i) => {
    const date = shiftDate(anchor, -i);
    const activeCalories = i === 0 ? 230 : 300 + (i % 7) * 80;
    return {
      id: uid(),
      date,
      activeCalories,
      totalCalories: (i === 0 ? 850 : 1700) + activeCalories,
      minutes: i === 0 ? 20 : 20 + (i % 5) * 12,
      source: "watch",
      simulated: true,
      updatedAt: date + "T12:00:00",
    };
  });
export const createDemo = (anchor = today()): AppData => {
  const profile = {
    ...initialProfile("alex@exemplo.com"),
    name: "Alex Morgan",
    onboarded: true,
    weight: 78.4,
    experience: "intermediate" as const,
    months: 10,
  };
  const plan = samplePlan();
  const second = {
    ...samplePlan(),
    id: uid(),
    name: "Essencial em 30 minutos",
    description: "Corpo inteiro · Dias corridos",
    active: false,
    days: [
      {
        id: uid(),
        name: "Full body · Corpo inteiro",
        exercises: [
          prescription(0, 30),
          prescription(1, 25),
          prescription(2, 25),
        ],
      },
    ],
  };
  const goals: GoalSnapshot[] = [
    {
      date: shiftDate(anchor, -90),
      calories: 2300,
      protein: 140,
      carbs: 278,
      fat: 70,
      frequency: 3,
    },
    {
      date: shiftDate(anchor, -30),
      calories: 2200,
      protein: 140,
      carbs: 253,
      fat: 70,
      frequency: 3,
    },
  ];
  const meals: Meal[] = [];
  const measurements: Measurement[] = [];
  const sessions: Session[] = [];
  for (let i = 89; i >= 0; i--) {
    const date = shiftDate(anchor, -i);
    if (i % 17 !== 8) {
      const templates = [
        [
          food("Pão integral", 148, 6, 26, 2.4, 60),
          food("Ovos mexidos", 156, 13, 1.2, 11, 100),
          food("Banana", 89, 1.1, 23, 0.3, 100),
        ],
        [
          ...sampleFoods(),
          food("Feijão carioca", 76, 4.8, 13.6, 0.5, 100),
          food("Azeite de oliva", 90, 0, 0, 10, 10),
        ],
        [
          food("Iogurte natural", 110, 9, 12, 3, 170),
          food("Granola", 160, 4, 26, 5, 40),
        ],
        [
          food("Salmão grelhado", 309, 33, 0, 19, 150),
          food("Batata-doce", 154, 1.2, 36, 0.2, 200),
          food("Salada verde", 45, 2, 8, 0.5, 120),
        ],
      ];
      const goal = i > 30 ? 2300 : 2200;
      const ratio =
        i === 0
          ? 1
          : (goal * (0.84 + (i % 7) * 0.05)) /
            sumMacros(templates.flat()).calories;
      templates
        .slice(0, i === 0 ? 2 : i % 19 === 4 ? 2 : 4)
        .forEach((items, j) =>
          meals.push({
            id: uid(),
            date,
            time: ["07:30", "12:40", "16:00", "20:00"][j],
            type: MEAL_TYPES[j],
            items: items.map((item) => ({
              ...item,
              calories: Math.round(item.calories * ratio),
              protein: +(item.protein * ratio).toFixed(1),
              carbs: +(item.carbs * ratio).toFixed(1),
              fat: +(item.fat * ratio).toFixed(1),
              portion: Math.round(item.portion * ratio),
            })),
          }),
        );
    }
    if (i % 7 === 0)
      measurements.push({
        id: uid(),
        date,
        weight: +(78.4 + i * 0.055 + Math.sin(i) * 0.15).toFixed(1),
        waist: +(84 + i * 0.065).toFixed(1),
        arm: +(35 + i * 0.008).toFixed(1),
        photo: i % 28 === 0 ? "/progress.svg" : undefined,
      });
    const weekday = new Date(date + "T12:00:00").getDay();
    if (i > 0 && [1, 3, 5].includes(weekday) && i % 13 !== 0) {
      const s = startSession(
        plan.days[[1, 3, 5].indexOf(weekday)],
        plan.id,
        date,
      );
      s.startedAt = date + "T18:00:00";
      s.finishedAt = date + "T18:46:00";
      s.duration = 2760;
      s.exercises.forEach((e) =>
        e.sets.forEach((set) => {
          set.done = true;
          if (set.weight)
            set.weight = Math.max(0, set.weight - Math.floor(i / 21) * 2);
        }),
      );
      sessions.push(s);
    }
  }
  return {
    version: 1,
    profile,
    goals,
    meals,
    measurements,
    confirmedFoodDays: [...new Set(meals.map((m) => m.date))].filter(
      (date) =>
        date < anchor && meals.filter((m) => m.date === date).length >= 4,
    ),
    energy: sampleEnergy(anchor),
    plans: [plan, second],
    sessions,
  };
};
