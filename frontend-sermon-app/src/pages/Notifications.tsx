import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, send } from "../api";
import { ActionError, useAction } from "../features";
import { Empty, ErrorState, Loading, PageHeading, Pagination } from "../ui";
interface Notice {
  id: string;
  kind: "sermons" | "plans" | "replies";
  title: string;
  target: string;
  readAt: string | null;
  createdAt: string;
}
interface Preferences {
  sermons: boolean;
  plans: boolean;
  replies: boolean;
}
const keys = [["notifications"], ["notification-count"]];
export function NotificationBell() {
  const query = useQuery({
    queryKey: ["notification-count"],
    queryFn: () =>
      api<{ count: number }>("/notifications/unread-count", {
        cache: "no-store",
      }),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  const count = query.data?.data.count ?? 0;
  return (
    <Link
      to="/notifications"
      className="icon-button relative shrink-0"
      aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
    >
      <Bell size={21} aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
export function NotificationsPage() {
  const [page, setPage] = useState(1),
    [unread, setUnread] = useState(false);
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["notifications", page, unread],
    queryFn: () =>
      api<Notice[]>(`/notifications?page=${page}&limit=20&unread=${unread}`, {
        cache: "no-store",
      }),
    refetchInterval: 30_000,
    staleTime: 0,
  });
  useEffect(() => {
    const total = Math.max(1, query.data?.meta?.totalPages ?? 1);
    if (query.data && page > total) setPage(total);
  }, [query.data, page]);
  const preferences = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api<Preferences>("/notifications/preferences"),
  });
  const mark = useAction(
    (id: string) => api(`/notifications/${id}/read`, { method: "PATCH" }),
    keys,
    () => setPage(1),
  );
  const all = useAction(
    () => api("/notifications/read-all", { method: "PATCH" }),
    keys,
    () => setPage(1),
  );
  return (
    <>
      <PageHeading eyebrow="YOUR ONEBODY UPDATES" title="Notifications.">
        New messages, study plans, and replies from your fellowship.
      </PageHeading>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => {
              setUnread(e.target.checked);
              setPage(1);
            }}
          />
          Unread only
        </label>
        <button
          className="btn-secondary"
          disabled={
            all.isPending || query.isPending || !query.data?.data.length
          }
          onClick={() => all.mutate()}
        >
          Mark all as read
        </button>
      </div>
      <ActionError error={mark.error ?? all.error} />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.data.length ? (
        <Empty
          title={unread ? "You’re all caught up." : "No notifications yet."}
        >
          <p>
            Updates will appear here when new content is published or someone
            replies to your post.
          </p>
        </Empty>
      ) : (
        <>
          <ul className="space-y-3" aria-label="Your notifications">
            {query.data.data.map((item) => (
              <li
                key={item.id}
                className={`panel p-5 flex flex-wrap items-center justify-between gap-4 ${!item.readAt ? "border-l-4 border-l-secondary" : ""}`}
              >
                <Link
                  className="min-w-0 grow basis-48"
                  to={item.target}
                  onClick={(e) => {
                    if (!item.readAt) {
                      e.preventDefault();
                      mark.mutate(item.id, {
                        onSuccess: () => navigate(item.target),
                      });
                    }
                  }}
                >
                  {!item.readAt && <span className="badge mb-2">Unread</span>}
                  <span className="block font-semibold break-words">
                    {item.title}
                  </span>
                  <time
                    className="text-xs text-muted mt-2 block"
                    dateTime={item.createdAt}
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </Link>
                {!item.readAt && (
                  <button
                    className="text-link text-xs"
                    disabled={mark.isPending}
                    onClick={() => mark.mutate(item.id)}
                  >
                    Mark as read
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            totalPages={query.data.meta?.totalPages ?? 1}
            change={setPage}
          />
        </>
      )}
      <section
        className="panel p-5 sm:p-6 mt-8"
        aria-label="Notification preferences"
      >
        <h2 className="font-serif text-2xl mb-2">Choose your updates.</h2>
        <p className="text-sm text-muted mb-5">
          Choose which new in-app notifications you receive. Existing
          notifications stay in your inbox.
        </p>
        {preferences.isPending ? (
          <Loading />
        ) : preferences.isError ? (
          <ErrorState
            error={preferences.error}
            retry={() => void preferences.refetch()}
          />
        ) : (
          <PreferenceForm initial={preferences.data.data} />
        )}
      </section>
    </>
  );
}
function PreferenceForm({ initial }: { initial: Preferences }) {
  const [values, setValues] = useState(initial),
    [saved, setSaved] = useState(false);
  const action = useAction(
    (body: Preferences) =>
      api("/notifications/preferences", send("PATCH", body)),
    [["notification-preferences"]],
    () => setSaved(true),
  );
  function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    action.mutate(values);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {(
        [
          ["sermons", "New sermons"],
          ["plans", "New study plans"],
          ["replies", "Replies to my fellowship posts"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex gap-3 items-center text-sm">
          <input
            type="checkbox"
            checked={values[key]}
            onChange={(e) => {
              setSaved(false);
              setValues({ ...values, [key]: e.target.checked });
            }}
          />
          {label}
        </label>
      ))}
      <ActionError error={action.error} />
      <button className="btn-primary" disabled={action.isPending}>
        Save preferences
      </button>
      {saved && (
        <p role="status" className="text-sm text-muted">
          Notification preferences saved.
        </p>
      )}
    </form>
  );
}
