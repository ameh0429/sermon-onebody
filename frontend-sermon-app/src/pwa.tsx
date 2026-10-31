import { useEffect, useState } from "react";
import { Download, WifiOff, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return (
    <>
      {!online && (
        <div className="connection-banner" role="status">
          <WifiOff size={16} />
          You’re offline. Reconnect to sign in, load content, or save progress.
        </div>
      )}
      {needRefresh && (
        <div className="update-banner" role="status">
          <span>
            A fresh version of OneBody is ready. Updating will sign you out.
          </span>
          <button
            className="text-link"
            onClick={() => void updateServiceWorker(true)}
          >
            Update
          </button>
          <button
            aria-label="Dismiss update"
            onClick={() => setNeedRefresh(false)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(
    window.matchMedia("(display-mode: standalone)").matches,
  );
  useEffect(() => {
    const before = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function install() {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } else setHelp(!help);
  }
  if (installed)
    return (
      <p className="text-sm text-muted">OneBody is installed on this device.</p>
    );
  return (
    <div>
      <button className="btn-secondary" onClick={() => void install()}>
        <Download size={17} />
        Install OneBody
      </button>
      {help && (
        <p className="mt-3 text-sm leading-relaxed text-muted" role="status">
          On iPhone, open in Safari, tap Share, then “Add to Home Screen.” On
          other supported browsers, choose “Install app” in the browser menu.
          Installation requires HTTPS (or localhost).
        </p>
      )}
    </div>
  );
}
