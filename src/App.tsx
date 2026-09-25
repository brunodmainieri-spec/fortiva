import { AssistantProvider, AssistantLauncher } from "./assistant";
import { lazy, Suspense, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { AppProvider, useApp, useData } from "./store";
import { dateLabel, today } from "./domain";
import { Button, IconButton, Logo, Modal } from "./ui";
import {
  AuthPage,
  Onboarding,
  ProfilePage,
  ResetPasswordPage,
} from "./profile";
import { Dashboard } from "./nutrition";
const WorkoutPage = lazy(() =>
  import("./training").then((m) => ({ default: m.WorkoutPage })),
);
const EvolutionPage = lazy(() =>
  import("./evolution").then((m) => ({ default: m.EvolutionPage })),
);

const links = [
  { to: "/", icon: LayoutDashboard, label: "Hoje", sub: "Seu diário" },
  {
    to: "/treinos",
    icon: Dumbbell,
    label: "Treinos",
    sub: "Seu próximo nível",
  },
  {
    to: "/evolucao",
    icon: TrendingUp,
    label: "Evolução",
    sub: "Cada conquista conta",
  },
  { to: "/perfil", icon: UserRound, label: "Perfil", sub: "Do seu jeito" },
];
function Shell() {
  const { data, logout, notice, undoAvailable, undoBusy, undoNotice } =
    useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState(false);
  if (!data) return <Navigate to="/entrar" replace />;
  if (!data.profile.onboarded) return <Navigate to="/onboarding" replace />;
  return (
    <AssistantProvider key={data.profile.email}>
      <div className="app-shell">
        <aside className="sidebar">
          <NavLink to="/" aria-label="FORTIVA início">
            <Logo />
          </NavLink>
          <div className="nav-caption">SEU ESPAÇO</div>
          <nav>
            {links.map(({ to, icon: Icon, label, sub }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  "nav-item " + (isActive ? "selected" : "")
                }
              >
                <Icon size={21} />
                <span>
                  {label}
                  <small>{sub}</small>
                </span>
                <ChevronRight className="nav-chevron" size={15} />
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              className="sidebar-user"
              onClick={() => navigate("/perfil")}
            >
              <span className="avatar">{data.profile.name.slice(0, 1)}</span>
              <span>
                {data.profile.name.split(" ")[0]}
                <small>Meu perfil</small>
              </span>
              <Settings2 size={17} />
            </button>
            <button className="logout" onClick={logout}>
              <LogOut size={15} />
              Sair da conta
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="topbar-location">
              <Activity size={17} />
              <span>Seu espaço de evolução</span>
            </div>
            <div className="topbar-actions">
              <AssistantLauncher />
              <span className="top-date">
                <CalendarDays size={15} />
                {dateLabel(today(), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                className="search-trigger"
                onClick={() => setSearch(true)}
                aria-label="Buscar no aplicativo"
              >
                <Search size={17} />
                <span>Buscar</span>
                <kbd>⌕</kbd>
              </button>
              <button
                className="avatar avatar-small"
                aria-label="Abrir perfil"
                onClick={() => navigate("/perfil")}
              >
                {data.profile.name.slice(0, 1)}
              </button>
            </div>
          </header>
          <main className="main-content">
            <Suspense
              fallback={
                <div className="empty" role="status">
                  Carregando seu espaço...
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>
          <footer className="app-footer">
            <span>Feito para acompanhar você.</span>
            <span>
              FORTIVA <ArrowUpRight size={13} />
            </span>
          </footer>
        </div>
        <nav className="bottom-nav" aria-label="Navegação principal">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={21} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {notice && (
          <div className="toast" role="status">
            <span>✓</span>
            {notice}
            {undoAvailable && (
              <button
                className="undo-action"
                disabled={undoBusy}
                onClick={() => void undoNotice()}
              >
                {undoBusy ? "Desfazendo…" : "Desfazer"}
              </button>
            )}
          </div>
        )}
        {search && <SearchModal onClose={() => setSearch(false)} />}
      </div>
    </AssistantProvider>
  );
}
function SearchModal({ onClose }: { onClose: () => void }) {
  const data = useData();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const text = query.toLocaleLowerCase("pt-BR").trim();
  const results = text
    ? [
        ...data.meals
          .filter((m) =>
            (m.type + " " + m.items.map((i) => i.name).join(" "))
              .toLocaleLowerCase("pt-BR")
              .includes(text),
          )
          .slice(-5)
          .reverse()
          .map((m) => ({
            key: m.id,
            title: m.type,
            sub:
              dateLabel(m.date) + " · " + m.items.map((i) => i.name).join(", "),
            to: "/?date=" + m.date,
          })),
        ...data.plans
          .filter((p) =>
            (
              p.name +
              p.days
                .map((d) => d.exercises.map((e) => e.name).join(" "))
                .join(" ")
            )
              .toLocaleLowerCase("pt-BR")
              .includes(text),
          )
          .map((p) => ({
            key: p.id,
            title: p.name,
            sub: "Plano de treino",
            to: "/treinos?plan=" + p.id,
          })),
      ]
    : [];
  return (
    <Modal
      title="Encontre no seu histórico"
      subtitle="Busque alimentos, refeições, exercícios e planos."
      onClose={onClose}
    >
      <div className="search-input">
        <Search size={20} />
        <input
          autoFocus
          aria-label="Pesquisar"
          placeholder="O que você está procurando?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <IconButton label="Limpar busca" onClick={() => setQuery("")}>
            <X size={16} />
          </IconButton>
        )}
      </div>
      <div className="search-results">
        {results.map((r) => (
          <button
            key={r.key}
            onClick={() => {
              navigate(r.to);
              onClose();
            }}
          >
            <span>
              <strong>{r.title}</strong>
              <small>{r.sub}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
        {text && !results.length && (
          <p className="muted center">Nenhum resultado. Tente outro termo.</p>
        )}
        {!text && (
          <p className="muted center">Experimente “frango” ou “supino”.</p>
        )}
      </div>
    </Modal>
  );
}
function ProtectedOnboarding() {
  const { data } = useApp();
  return data ? <Onboarding /> : <Navigate to="/entrar" replace />;
}
function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="empty">
      <h1>Vamos voltar ao seu ritmo?</h1>
      <p>Esta página não existe.</p>
      <Button onClick={() => navigate("/")}>Ir para o diário</Button>
    </div>
  );
}
function RecoveryRedirect() {
  const { recovery } = useApp();
  const location = useLocation();
  return recovery && location.pathname !== "/redefinir-senha" ? (
    <Navigate to="/redefinir-senha" replace />
  ) : null;
}
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <RecoveryRedirect />
        <Routes>
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/entrar" element={<AuthPage />} />
          <Route path="/onboarding" element={<ProtectedOnboarding />} />
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="/treinos" element={<WorkoutPage />} />
            <Route path="/evolucao" element={<EvolutionPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
