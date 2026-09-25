import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "./ui";
import "./pwa.css";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const PwaContext = createContext<{
  installed: boolean;
  prompt: InstallPrompt | null;
  clearPrompt: () => void;
}>({ installed: false, prompt: null, clearPrompt: () => {} });

export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const checkInstalled = () =>
      setInstalled(
        media.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setPrompt(null);
      setInstalled(true);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    checkInstalled();
    media.addEventListener("change", checkInstalled);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      media.removeEventListener("change", checkInstalled);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  return (
    <PwaContext.Provider
      value={{ installed, prompt, clearPrompt: () => setPrompt(null) }}
    >
      {children}
      {!online && (
        <div className="pwa-connection" role="status">
          Sem conexão. Reconecte-se antes de salvar seus registros.
        </div>
      )}
    </PwaContext.Provider>
  );
}

export function InstallAppCard() {
  const { installed, prompt, clearPrompt } = useContext(PwaContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const install = async () => {
    if (!prompt || busy) return;
    setBusy(true);
    setError("");
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setError("Abra o menu do navegador e escolha Adicionar à tela inicial.");
    } finally {
      clearPrompt();
      setBusy(false);
    }
  };
  return (
    <section className="pwa-install" aria-labelledby="pwa-install-title">
      <div className="pwa-install-heading">
        <Smartphone size={22} />
        <h3 id="pwa-install-title">FORTIVA no seu celular</h3>
      </div>
      {installed ? (
        <p>
          O aplicativo já está instalado. Use o ícone na tela inicial para
          abrir.
        </p>
      ) : (
        <>
          <p>
            Tenha um atalho na tela inicial e abra o FORTIVA como aplicativo.
          </p>
          {prompt && (
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              onClick={() => void install()}
            >
              <Download size={16} />
              Instalar aplicativo
            </Button>
          )}
          <p>
            <strong>Android:</strong> no menu do Chrome, escolha Instalar
            aplicativo ou Adicionar à tela inicial.
          </p>
          <p>
            <strong>iPhone:</strong> no Safari, toque em Compartilhar e depois
            em Adicionar à Tela de Início. Se aparecer, ative Abrir como App da
            Web.
          </p>
        </>
      )}
      <p className="muted small">
        É necessário estar conectado à internet para consultar e salvar seus
        registros.
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

// Development stays free of service workers. Preview/production require HTTPS
// (or localhost), and failures to register never block access to the application.
export function registerPwa() {
  if (
    import.meta.env.PROD &&
    "serviceWorker" in navigator &&
    window.isSecureContext
  ) {
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => {
        console.warn(
          "Não foi possível preparar a instalação do FORTIVA.",
          error,
        );
      });
  }
}
