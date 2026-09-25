import type { User } from "@supabase/supabase-js";
import { blankData } from "./domain";
import type { AppData } from "./domain";
import { getSupabase, serviceError } from "./supabase";

// A revision belongs to the exact object loaded/saved. Never reuse a revision
// from another tab or silently overwrite concurrent changes.
let loaded: { userId: string; revision: number } | null = null;
let epoch = 0;
let loadSequence = 0;
export function clearRepository() {
  epoch++;
  loaded = null;
}

async function currentUser() {
  const { data: sessionData, error: sessionError } =
    await getSupabase().auth.getSession();
  if (sessionError) throw serviceError(sessionError);
  if (!sessionData.session) throw new Error("Entre novamente para continuar.");
  const accessToken = sessionData.session.access_token;
  const { data, error } = await getSupabase().auth.getUser(accessToken);
  if (error) throw serviceError(error);
  if (!data.user) throw new Error("Entre novamente para continuar.");
  return { user: data.user, accessToken };
}

async function loadUser({
  user,
  accessToken,
}: {
  user: User;
  accessToken: string;
}): Promise<AppData> {
  const request = ++loadSequence;
  const started = epoch;
  const { data: result, error } = await getSupabase()
    .rpc("fortiva_load")
    .setHeader("Authorization", `Bearer ${accessToken}`);
  if (error) throw serviceError(error);
  const data: AppData =
    result?.document ??
    blankData(user.email ?? "", user.user_metadata?.name ?? "");
  data.profile.email = user.email ?? "";
  if (started !== epoch || request !== loadSequence)
    throw new Error("Sua sessão mudou. Entre novamente.");
  loaded = { userId: user.id, revision: result?.revision ?? 0 };
  return data;
}

export const repository = {
  async load() {
    return loadUser(await currentUser());
  },
  async save(data: AppData) {
    const snapshot = loaded;
    const started = epoch;
    const { user, accessToken } = await currentUser();
    if (!snapshot || snapshot.userId !== user.id || started !== epoch)
      throw new Error("Sua sessão mudou. Recarregue a página.");
    if (data.energy.some((entry) => entry.simulated))
      throw new Error(
        "Registros de demonstração não podem ser salvos na conta real.",
      );
    const { data: revision, error } = await getSupabase()
      .rpc("fortiva_save", {
        document: { ...data, profile: { ...data.profile, email: user.email } },
        expected_revision: snapshot.revision,
      })
      .setHeader("Authorization", `Bearer ${accessToken}`);
    if (error) throw serviceError(error);
    if (started !== epoch)
      throw new Error("Sua sessão mudou. Entre novamente.");
    loaded = { userId: user.id, revision };
  },
};

const normalize = (email: string) => email.trim().toLowerCase();
export const auth = {
  async current(): Promise<AppData | null> {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw serviceError(error);
    return data.session ? loadUser(await currentUser()) : null;
  },
  async signIn(email: string, password: string) {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: normalize(email),
      password,
    });
    if (error) throw serviceError(error);
    return loadUser({
      user: data.user,
      accessToken: data.session.access_token,
    });
  },
  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<AppData | null> {
    if (name.trim().length < 2)
      throw new Error("Informe um nome com pelo menos dois caracteres.");
    const { data, error } = await getSupabase().auth.signUp({
      email: normalize(email),
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: window.location.origin + "/entrar",
      },
    });
    if (error) throw serviceError(error);
    return data.session && data.user
      ? loadUser({ user: data.user, accessToken: data.session.access_token })
      : null;
  },
  async signOut() {
    const { error } = await getSupabase().auth.signOut({ scope: "local" });
    if (error) throw serviceError(error);
    clearRepository();
  },
  async recover(email: string) {
    const { error } = await getSupabase().auth.resetPasswordForEmail(
      normalize(email),
      {
        redirectTo: window.location.origin + "/redefinir-senha",
      },
    );
    if (error) throw serviceError(error);
  },
  async updatePassword(password: string) {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw serviceError(error);
  },
};
