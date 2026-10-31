import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  LoaderCircle,
  Sprout,
} from "lucide-react";
import { Link } from "react-router-dom";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <Sprout size={25} strokeWidth={1.7} />
      </span>
      <span>
        onebody<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state-box" role="status">
      <LoaderCircle className="animate-spin text-forest" size={24} />
      <p>{label}</p>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={20} className="shrink-0" />
      <div>
        <p>
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
        {retry && (
          <button onClick={retry} className="text-link mt-2">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="state-box rounded-2xl border border-dashed border-line bg-white/60">
      <BookOpen size={28} className="text-sage" />
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      <div className="max-w-md text-center">{children}</div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      {children && (
        <p className="mt-3 max-w-2xl text-muted leading-relaxed">{children}</p>
      )}
    </header>
  );
}
export function Back({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="back-link" to={to}>
      <ArrowLeft size={16} />
      {children}
    </Link>
  );
}
export function Pagination({
  page,
  totalPages,
  change,
}: {
  page: number;
  totalPages: number;
  change: (n: number) => void;
}) {
  return totalPages > 1 ? (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-center gap-5"
    >
      <button
        className="btn-secondary"
        onClick={() => change(page - 1)}
        disabled={page <= 1}
      >
        <ArrowLeft size={16} />
        Previous
      </button>
      <span className="text-sm text-muted">
        {page} of {totalPages}
      </span>
      <button
        className="btn-secondary"
        onClick={() => change(page + 1)}
        disabled={page >= totalPages}
      >
        Next
        <ArrowRight size={16} />
      </button>
    </nav>
  ) : null;
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date.length === 10 ? `${date}T12:00:00` : date));
}
