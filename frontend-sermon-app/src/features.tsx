import { useState, type FormEvent, type ReactNode } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "./api";
import type { Envelope, Sermon } from "./types";
import { ErrorState, Pagination } from "./ui";
export function useAction<T = void, V = void>(
  run: (variables: V) => Promise<T>,
  keys: QueryKey[],
  onSuccess?: (value: T) => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async (value) => {
      await Promise.all(
        keys.map((queryKey) => client.invalidateQueries({ queryKey })),
      );
      onSuccess?.(value);
    },
  });
}
export function ActionError({ error }: { error: unknown }) {
  return error ? (
    <div className="my-4">
      <ErrorState error={error} />
    </div>
  ) : null;
}
export function ConfirmButton({
  children,
  message,
  onConfirm,
  disabled = false,
  className = "btn-secondary",
}: {
  children: ReactNode;
  message: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => {
        if (window.confirm(message)) onConfirm();
      }}
    >
      {children}
    </button>
  );
}
export function ListSearch({
  placeholder = "Search…",
  children,
}: {
  placeholder?: string;
  children?: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    q ? next.set("q", q) : next.delete("q");
    next.delete("page");
    setParams(next);
  }
  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap gap-3 mb-6"
      key={params.get("q") ?? ""}
    >
      <div className="search-input grow">
        <Search size={18} />
        <label className="sr-only" htmlFor="list-search">
          Search
        </label>
        <input
          id="list-search"
          name="q"
          placeholder={placeholder}
          defaultValue={params.get("q") ?? ""}
          maxLength={120}
        />
        <button type="submit" className="text-link">
          Search
        </button>
        {params.has("q") && (
          <button
            type="button"
            className="text-sm"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("q");
              next.delete("page");
              setParams(next);
            }}
          >
            Clear
          </button>
        )}
      </div>
      {children}
    </form>
  );
}
export function ListPages({
  data,
}: {
  data?: Pick<Envelope<unknown>, "meta">;
}) {
  const [params, setParams] = useSearchParams();
  return data?.meta ? (
    <Pagination
      page={data.meta.page}
      totalPages={data.meta.totalPages}
      change={(page) => {
        const next = new URLSearchParams(params);
        next.set("page", String(page));
        setParams(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  ) : null;
}
export function FeatureTabs({
  links,
}: {
  links: { to: string; label: string }[];
}) {
  return (
    <nav className="feature-tabs" aria-label="Section navigation">
      {links.map((l) => (
        <Link key={l.to} to={l.to}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
/** Searchable server-side selection; never assumes the first page contains every sermon. */
export function SermonPicker({
  value,
  onChange,
  staff = false,
  required = false,
}: {
  value: string;
  onChange: (id: string) => void;
  staff?: boolean;
  required?: boolean;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const sermons = useQuery({
    queryKey: ["sermon-picker", q, page, staff],
    queryFn: () =>
      api<Sermon[]>(
        `/sermons?limit=10&page=${page}&q=${encodeURIComponent(q)}${staff ? "" : "&status=published"}`,
      ),
  });
  const selected = useQuery({
    queryKey: ["sermon-selection", value],
    queryFn: () => api<Sermon>(`/sermons/${value}`),
    enabled: !!value,
  });
  return (
    <fieldset className="picker">
      <legend className="text-xs font-semibold mb-2">
        Related sermon{required ? " *" : " (optional)"}
      </legend>
      <label className="field">
        Find a sermon
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          maxLength={200}
          placeholder="Search by title or passage"
        />
      </label>
      <label className="field mt-3">
        Select sermon
        <select
          aria-label="Select sermon"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        >
          <option value="">
            {required ? "Choose a sermon" : "No related sermon"}
          </option>
          {value && !sermons.data?.data.some((s) => s.id === value) && (
            <option value={value}>
              {selected.data?.data.title ?? "Current sermon"}
            </option>
          )}
          {sermons.data?.data.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
              {staff ? ` · ${s.status}` : ""}
            </option>
          ))}
        </select>
      </label>
      <ActionError error={sermons.error ?? selected.error} />
      {sermons.data?.meta && (
        <Pagination
          page={page}
          totalPages={sermons.data.meta.totalPages}
          change={setPage}
        />
      )}
    </fieldset>
  );
}
