import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, send, session } from "./api";
import type { Envelope, User } from "./types";
interface Auth {
  user: User | null;
  expired: boolean;
  login: (
    body: { email: string; password: string; name?: string },
    register?: boolean,
  ) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateAccount: (request: () => Promise<Envelope<User>>) => Promise<void>;
}
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [expired, setExpired] = useState(false);
  const client = useQueryClient();
  const generation = useRef(0);
  function logout() {
    generation.current++;
    session.set(null);
    setUser(null);
    client.clear();
  }
  useEffect(() => {
    session.onExpired(() => {
      generation.current++;
      session.set(null);
      setUser(null);
      setExpired(true);
      client.clear();
    });
    return () => session.onExpired(() => {});
  }, [client]);
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
    return data.user;
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
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth provider missing");
  return value;
}
