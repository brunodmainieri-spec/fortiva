import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export function getSupabase() {
  if (!supabase)
    throw new Error(
      "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local e reinicie o aplicativo.",
    );
  return supabase;
}

export function serviceError(error: { message: string; code?: string }) {
  const messages: Record<string, string> = {
    session_not_found:
      "Sua sessão expirou. Entre novamente ou solicite outro link de recuperação.",
    invalid_credentials: "E-mail ou senha incorretos.",
    email_not_confirmed: "Confirme seu e-mail antes de entrar.",
    user_already_exists: "Já existe uma conta com este e-mail.",
    weak_password: "Escolha uma senha mais forte, com pelo menos 6 caracteres.",
    same_password: "Escolha uma senha diferente da anterior.",
    over_email_send_rate_limit:
      "Aguarde alguns minutos antes de solicitar outro e-mail.",
    PGRST202:
      "O banco ainda precisa ser preparado. Execute a migração SQL do projeto no Supabase.",
    PGRST205:
      "O banco ainda precisa ser preparado. Execute a migração SQL do projeto no Supabase.",
    "40001":
      "Seus dados mudaram em outra aba ou dispositivo. Recarregue a página antes de salvar novamente.",
  };
  const legacyCodes: Record<string, string> = {
    "Invalid login credentials": "invalid_credentials",
    "Email not confirmed": "email_not_confirmed",
    "Auth session missing!": "session_not_found",
  };
  const code = error.code ?? legacyCodes[error.message];
  return new Error(messages[code ?? ""] ?? error.message);
}
