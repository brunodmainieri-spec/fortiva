import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppData } from "./domain";
import { auth, repository } from "./services";
import { clearRepository } from "./cloud-services";
import { supabase } from "./supabase";
type Store = {
  data: AppData | null;
  startupError: string;
  recovery: boolean;
  finishRecovery: () => void;
  notice: string;
  enter: (data: AppData) => void;
  logout: () => void;
  update: (fn: (data: AppData) => AppData) => Promise<void>;
  notify: (text: string, undo?: () => Promise<void>) => void;
  undoAvailable: boolean;
  undoBusy: boolean;
  undoNotice: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [startupError, setStartupError] = useState("");
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(
    window.location.pathname === "/redefinir-senha",
  );
  const generation = useRef(0);
  const startup = useRef<Promise<AppData | null> | null>(null);
  const ref = useRef(data);
  const queue = useRef(Promise.resolve());
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const undoAction = useRef<(() => Promise<void>) | undefined>(undefined);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const notify = (text: string, undo?: () => Promise<void>) => {
    clearTimeout(timer.current);
    undoAction.current = undo;
    setUndoAvailable(Boolean(undo));
    setNotice(text);
    timer.current = setTimeout(
      () => {
        setNotice("");
        undoAction.current = undefined;
        setUndoAvailable(false);
      },
      undo ? 12000 : 4500,
    );
  };
  const undoNotice = async () => {
    const action = undoAction.current;
    if (!action || undoBusy) return;
    clearTimeout(timer.current);
    setUndoBusy(true);
    try {
      await action();
      notify("Ação desfeita.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setUndoBusy(false);
    }
  };
  const enter = (next: AppData) => {
    setStartupError("");
    ref.current = next;
    setData(next);
  };
  const clear = () => {
    generation.current++;
    clearRepository();
    clearTimeout(timer.current);
    undoAction.current = undefined;
    setUndoAvailable(false);
    setNotice("");
    ref.current = null;
    setData(null);
  };
  const logout = () => {
    void auth
      .signOut()
      .then(clear)
      .catch((error: Error) => notify(error.message));
  };
  useEffect(() => {
    let active = true;
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") clear();
      if (
        event === "SIGNED_IN" &&
        ref.current &&
        session?.user.email !== ref.current.profile.email
      ) {
        clear();
        window.location.reload();
      }
    }).data.subscription;
    const started = generation.current;
    startup.current ??= auth.current();
    void startup.current
      .then((next) => {
        if (active && generation.current === started) {
          ref.current = next;
          setData(next);
        }
      })
      .catch((error: Error) => {
        if (active) setStartupError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      subscription?.unsubscribe();
      clearTimeout(timer.current);
    };
  }, []);
  const update = (fn: (data: AppData) => AppData) => {
    const started = generation.current;
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        if (started !== generation.current)
          throw new Error("Sua sessão mudou. Entre novamente.");
        if (!ref.current) throw new Error("Entre novamente para continuar.");
        const next = fn(structuredClone(ref.current));
        await repository.save(next);
        if (started === generation.current) enter(next);
      });
    queue.current = task;
    return task;
  };
  return (
    <Context.Provider
      value={{
        data,
        startupError,
        recovery,
        finishRecovery: () => setRecovery(false),
        notice,
        enter,
        logout,
        update,
        notify,
        undoAvailable,
        undoBusy,
        undoNotice,
      }}
    >
      {loading ? (
        <div className="empty" role="status">
          Carregando sua conta...
        </div>
      ) : (
        children
      )}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider ausente");
  return value;
}
export function useData() {
  const { data } = useApp();
  if (!data) throw new Error("Perfil ausente");
  return data;
}
