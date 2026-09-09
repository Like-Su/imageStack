import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { authApi } from "@/api/auth";
import { ApiError, getErrorMessage } from "@/api/request";
import type {
  AuthTokens,
  AuthUser,
  LoginPayload,
  StoredSession,
} from "@/types/auth";

const SESSION_KEY = "image_stack_auth";
const USER_KEY = "image_stack_user";

function getStorage(remember: boolean): Storage | null {
  try {
    return remember ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readSession(): StoredSession | null {
  for (const remember of [false, true]) {
    try {
      const raw = getStorage(remember)?.getItem(SESSION_KEY);
      if (!raw) continue;
      const saved = JSON.parse(raw) as Partial<StoredSession> | null;
      if (
        saved &&
        typeof saved.accessToken === "string" &&
        saved.accessToken &&
        typeof saved.refreshToken === "string" &&
        saved.refreshToken &&
        typeof saved.expiresAt === "number" &&
        Number.isFinite(saved.expiresAt) &&
        typeof saved.expiresIn === "number" &&
        Number.isFinite(saved.expiresIn)
      ) {
        return { ...saved, remember } as StoredSession;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function persistSession(session: StoredSession | null, user: AuthUser | null) {
  for (const remember of [false, true]) {
    try {
      const storage = getStorage(remember);
      if (session?.remember === remember) {
        storage?.setItem(SESSION_KEY, JSON.stringify(session));
        if (user) storage?.setItem(USER_KEY, JSON.stringify(user));
        else storage?.removeItem(USER_KEY);
      } else {
        storage?.removeItem(SESSION_KEY);
        storage?.removeItem(USER_KEY);
      }
    } catch {
      continue;
    }
  }
}

export const useAuthStore = defineStore("auth", () => {
  const session = ref<StoredSession | null>(readSession());
  const user = ref<AuthUser | null>(null);
  const initialized = ref(false);
  const initializationError = ref("");
  const accessToken = computed(() => session.value?.accessToken ?? null);
  const isAuthenticated = computed(() => Boolean(session.value && user.value));
  let refreshPromise: Promise<boolean> | null = null;
  let initializePromise: Promise<void> | null = null;
  let sessionVersion = 0;

  function clearSession() {
    sessionVersion += 1;
    session.value = null;
    user.value = null;
    initialized.value = true;
    persistSession(null, null);
  }

  function saveTokens(tokens: AuthTokens, remember: boolean) {
    session.value = {
      ...tokens,
      remember,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
    persistSession(session.value, user.value);
  }

  async function login(payload: LoginPayload, remember: boolean) {
    initializationError.value = "";
    const tokens = await authApi.login(payload);
    const profile = await authApi.me(tokens.accessToken);
    if (!profile) throw new ApiError("无法读取账户信息，请联系管理员", 403);
    sessionVersion += 1;
    user.value = profile;
    saveTokens(tokens, remember);
    initialized.value = true;
  }

  function refreshSession(): Promise<boolean> {
    if (refreshPromise) return refreshPromise;
    const currentSession = session.value;
    if (!currentSession) return Promise.resolve(false);
    const currentVersion = sessionVersion;

    refreshPromise = (async () => {
      try {
        const tokens = await authApi.refresh(currentSession.refreshToken);
        if (sessionVersion !== currentVersion) return false;
        saveTokens(tokens, currentSession.remember);
        return true;
      } catch (error) {
        if (sessionVersion !== currentVersion) return false;
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          clearSession();
          return false;
        }
        throw error;
      }
    })().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  function initialize(): Promise<void> {
    if (initialized.value) return Promise.resolve();
    if (initializePromise) return initializePromise;
    const currentVersion = sessionVersion;

    initializePromise = (async () => {
      try {
        if (!session.value) return;
        if (
          session.value.expiresAt <= Date.now() + 30_000 &&
          !(await refreshSession())
        )
          return;
        const profile = await authApi.me();
        if (currentVersion !== sessionVersion) return;
        if (!profile) throw new ApiError("账户不可用，请重新登录", 401);
        user.value = profile;
        persistSession(session.value, profile);
      } catch (error) {
        if (currentVersion !== sessionVersion) return;
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        )
          clearSession();
        initializationError.value = getErrorMessage(error);
      } finally {
        initialized.value = true;
        initializePromise = null;
      }
    })();

    return initializePromise;
  }

  async function logout() {
    try {
      if (session.value) await authApi.logout(session.value.refreshToken);
    } finally {
      clearSession();
    }
  }

  return {
    user,
    accessToken,
    initialized,
    initializationError,
    isAuthenticated,
    login,
    logout,
    initialize,
    refreshSession,
    clearSession,
  };
});
