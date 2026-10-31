import { Avatar, ProfilePhotoEditor } from "../Avatar";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Leaf,
  LogOut,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { Brand, ErrorState, formatDate, PageHeading } from "../ui";
import { InstallApp, PwaStatus } from "../pwa";
import { ThemeControl } from "../theme";
export function AccountPage({ register = false }: { register?: boolean }) {
  const { user, login, expired } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null),
    [show, setShow] = useState(false);
  const destination =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/") &&
    !location.state.from.startsWith("//") &&
    !/^\/(login|register)/.test(location.state.from)
      ? location.state.from
      : "/sermons";
  if (user) return <Navigate to={destination} replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const values = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await login(
        {
          email: String(values.get("email")).trim(),
          password: String(values.get("password")),
          ...(register ? { name: String(values.get("name")).trim() } : {}),
        },
        register,
      );
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link to="/login">
          <Brand />
        </Link>
        <div className="auth-story-content">
          <p className="eyebrow text-lime!">FAITH FOR THE EVERYDAY</p>
          <h1 className="font-serif text-5xl leading-tight lg:text-6xl">
            A deeper faith.
            <br />
            One day at a time.
          </h1>
          <p className="mt-6 max-w-sm text-green-100/75 leading-relaxed">
            Make room for the Word. Discover a message, find a fresh
            perspective, and carry it into your week.
          </p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="sun" />
            <div className="hill hill-one" />
            <div className="hill hill-two" />
            <Leaf
              className="absolute bottom-12 left-10 text-lime"
              size={94}
              strokeWidth={0.8}
            />
          </div>
        </div>
        <p className="text-xs text-green-100/60">
          LOVE IS CHANGING HEARTS, LIGHTING EYES, MOVING HANDS AND LEADING FEET.
        </p>
      </section>
      <section className="auth-form-section">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="w-full max-w-sm">
          <p className="eyebrow">
            {register ? "YOUR NEXT CHAPTER" : "WELCOME BACK"}
          </p>
          <h2 className="font-serif text-4xl text-ink mt-3">
            {register ? "Let’s grow together." : "Good to see you."}
          </h2>
          <p className="text-muted mt-3 mb-8 leading-relaxed">
            {register
              ? "Create your account and begin your daily walk."
              : "Sign in to pick up your daily walk."}
          </p>
          {expired && !register && (
            <p
              className="mb-4 rounded-xl bg-warning-bg p-3 text-sm text-warning-ink"
              role="status"
            >
              Your session ended. Please sign in again.
            </p>
          )}
          <PwaStatus />
          <form
            onSubmit={submit}
            className="space-y-5"
            key={register ? "register" : "login"}
          >
            {register && (
              <label className="field">
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  required
                  placeholder="Your name"
                />
              </label>
            )}
            <label className="field">
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={255}
                placeholder="you@example.com"
              />
            </label>
            <div>
              <label className="field" htmlFor="password">
                Password
              </label>
              <div className="password-field">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  name="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength={register ? 8 : 1}
                  maxLength={128}
                  placeholder={
                    register ? "At least 8 characters" : "Enter your password"
                  }
                />
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error != null && <ErrorState error={error} />}
            <button
              className="btn-primary w-full justify-between"
              type="submit"
              disabled={pending}
            >
              {pending
                ? "Please wait…"
                : register
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="mt-6 text-sm text-muted">
            {register ? "Already part of OneBody?" : "New to OneBody?"}{" "}
            <Link
              to={register ? "/login" : "/register"}
              state={location.state}
              className="text-link"
              onClick={() => setError(null)}
            >
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <div className="mt-9 pt-6 border-t border-line flex gap-2 text-xs leading-relaxed text-muted">
            <ShieldCheck size={17} className="shrink-0" />
            <p>
              Your session stays in this tab’s memory. Refreshing or closing the
              app signs you out.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
export function ProfilePage() {
  const { user, logout, refresh } = useAuth();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState<unknown>(null);
  if (!user) return null;
  async function reload() {
    setPending(true);
    setError(null);
    setMessage("");
    try {
      await refresh();
      setMessage("Your profile is up to date.");
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeading eyebrow="YOUR ACCOUNT" title="A little about you.">
        Your place in the OneBody community.
      </PageHeading>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <ProfilePhotoEditor />
          <section className="panel p-6 sm:p-8">
            <div className="flex items-center gap-4 mb-8">
              <Avatar user={user} className="h-16! w-16! text-2xl!" />
              <div className="min-w-0">
                <h2 className="font-serif text-2xl break-words">{user.name}</h2>
                <span className="badge mt-2 capitalize">
                  {user.role === "leader" ? "Pastor" : user.role}
                </span>
              </div>
            </div>
            <dl className="divide-y divide-line">
              <div className="profile-row">
                <dt>Email address</dt>
                <dd className="flex gap-2 items-center break-all">
                  <Mail size={16} className="shrink-0" />
                  {user.email}
                </dd>
              </div>
              <div className="profile-row">
                <dt>Joined OneBody</dt>
                <dd>{formatDate(user.createdAt)}</dd>
              </div>
              <div className="profile-row">
                <dt>Account status</dt>
                <dd className="flex items-center gap-2">
                  <Check size={16} className="text-accent" />
                  {user.isActive ? "Active" : "Inactive"}
                </dd>
              </div>
            </dl>
            <button
              className="btn-secondary mt-6"
              onClick={() => void reload()}
              disabled={pending}
            >
              {pending ? "Refreshing…" : "Refresh profile"}
            </button>
            {message && (
              <p role="status" className="mt-4 text-sm text-accent">
                {message}
              </p>
            )}
            {error != null && (
              <div className="mt-4">
                <ErrorState error={error} />
              </div>
            )}
          </section>
        </div>
        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="font-serif text-2xl mb-3">
              Make yourself comfortable.
            </h2>
            <p className="text-sm text-muted mb-5">
              Choose your appearance, or let OneBody follow your device. This
              preference stays on this browser.
            </p>
            <ThemeControl />
          </section>
          <section className="panel p-6">
            <Leaf className="text-accent" size={24} />
            <h2 className="font-serif text-2xl mt-4 mb-3">
              Keep growth close.
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-5">
              Add OneBody to your home screen for a little less scrolling and a
              little more intention.
            </p>
            <InstallApp />
            {user.role !== "member" && (
              <Link to="/dashboard" className="text-link block mt-5 text-sm">
                Open dashboard
              </Link>
            )}
          </section>
          <section className="panel p-6">
            <h2 className="font-semibold mb-2">Your session</h2>
            <p className="text-sm text-muted mb-4 leading-relaxed">
              You’ll need to sign in again after refreshing or closing the app.
              Your completed lessons stay saved to your account.
            </p>
            <button
              onClick={logout}
              className="text-link flex items-center gap-2"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
