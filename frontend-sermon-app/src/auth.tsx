import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api, send, session } from "./api";
import type { Envelope, User } from "./types";
import { ErrorState, Loading } from "./ui";
interface Auth {
  user: User | null;
  expired: boolean;
  login: (
    body: { email: string; password: string; name?: string },
    register?: boolean,
  ) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateAccount: (request: () => Promise<Envelope<User>>) => Promise<void>;
}
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [expired, setExpired] = useState(false);
  const [restoring, setRestoring] = useState(() => session.hasToken());
  const [restoreError, setRestoreError] = useState<unknown>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const client = useQueryClient();
  const generation = useRef(0);
  function logout() {
    generation.current++;
    session.set(null);
    setUser(null);
    setRestoring(false);
    setRestoreError(null);
    client.clear();
  }
  useEffect(() => {
    session.onExpired(() => {
      generation.current++;
      session.set(null);
      setUser(null);
      setExpired(true);
      setRestoring(false);
      setRestoreError(null);
      client.clear();
    });
    return () => session.onExpired(() => {});
  }, [client]);
  useEffect(() => {
    if (!session.hasToken()) {
      setRestoring(false);
      return;
    }
    let active = true;
    const current = generation.current;
    setRestoring(true);
    setRestoreError(null);
    void api<User>("/users/me", { cache: "no-store" })
      .then(({ data }) => {
        if (active && current === generation.current) setUser(data);
      })
      .catch((error) => {
        if (!active || current !== generation.current) return;
        if (error instanceof ApiError && error.status === 401) {
          session.set(null);
          setUser(null);
          setExpired(true);
        } else setRestoreError(error);
      })
      .finally(() => {
        if (active && current === generation.current) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [restoreAttempt]);
  async function login(
    body: { email: string; password: string; name?: string },
    register = false,
  ) {
    const { data } = await api<{ user: User; token: string }>(
      register ? "/auth/register" : "/auth/login",
      send("POST", body),
    );
    generation.current++;
    client.clear();
    session.set(data.token);
    setUser(data.user);
    setExpired(false);
  }
  async function refresh() {
    const current = generation.current;
    const { data } = await api<User>("/users/me");
    if (current === generation.current) setUser(data);
  }
  async function updateAccount(request: () => Promise<Envelope<User>>) {
    const current = generation.current;
    const { data } = await request();
    if (current === generation.current) {
      setUser(data);
      await client.invalidateQueries({ queryKey: ["admin-users"] });
    }
  }
  return (
    <AuthContext.Provider
      value={{ user, expired, login, logout, refresh, updateAccount }}
    >
      {restoring ? (
        <Loading label="Restoring your session…" />
      ) : restoreError ? (
        <main className="max-w-md mx-auto p-6 space-y-4">
          <p>
            We couldn’t restore your session. Check your connection and try
            again.
          </p>
          <ErrorState
            error={restoreError}
            retry={() => setRestoreAttempt((value) => value + 1)}
          />
          <button className="btn-secondary" onClick={logout}>
            Return to sign in
          </button>
        </main>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth provider missing");
  return value;
}
