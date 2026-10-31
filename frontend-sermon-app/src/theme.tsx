import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Monitor, Moon, Sun } from "lucide-react";
type Preference = "system" | "light" | "dark";
const key = "onebody.theme";
function readPreference(): Preference {
  try {
    const value = localStorage.getItem(key);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* Use system when storage is blocked. */
  }
  return "system";
}
const ThemeContext = createContext<{
  preference: Preference;
  change: (value: Preference) => void;
} | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Preference>(readPreference);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const dark =
        preference === "dark" || (preference === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#142019" : "#254c3c");
    }
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);
  useEffect(() => {
    function sync(e: StorageEvent) {
      if (e.key === key || e.key === null) setPreference(readPreference());
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function change(value: Preference) {
    setPreference(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Keep working for this session. */
    }
  }
  return (
    <ThemeContext.Provider value={{ preference, change }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function ThemeControl() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("ThemeProvider missing");
  return (
    <fieldset className="theme-control">
      <legend className="sr-only">Color theme</legend>
      {(
        [
          { value: "light", label: "Light", icon: Sun },
          { value: "dark", label: "Dark", icon: Moon },
          { value: "system", label: "System", icon: Monitor },
        ] as const
      ).map(({ value, label, icon: Icon }) => (
        <button
          type="button"
          key={value}
          aria-pressed={theme.preference === value}
          onClick={() => theme.change(value)}
        >
          <Icon size={15} aria-hidden="true" />
          {label}
        </button>
      ))}
    </fieldset>
  );
}
