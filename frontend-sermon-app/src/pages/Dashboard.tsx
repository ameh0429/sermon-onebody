import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth";
import { api, send } from "../api";
import type { Analytics, Lesson, Plan, Sermon, User } from "../types";
import { Back, Empty, ErrorState, Loading, PageHeading } from "../ui";
import {
  ActionError,
  ConfirmButton,
  FeatureTabs,
  ListPages,
  ListSearch,
  SermonPicker,
  useAction,
} from "../features";
export function DashboardLayout() {
  const { user } = useAuth();
  if (user?.role === "member")
    return (
      <>
        <PageHeading
          eyebrow="ACCESS RESTRICTED"
          title="This space is for your leaders."
        />
        <p className="text-muted">Pastors and admins manage content here.</p>
        <Link className="text-link" to="/sermons">
          Back to the library
        </Link>
      </>
    );
  return (
    <>
      <FeatureTabs
        links={[
          { to: "/dashboard", label: "Overview" },
          { to: "/dashboard/sermons", label: "Sermons" },
          { to: "/dashboard/plans", label: "Study plans" },
          ...(user?.role === "admin"
            ? [{ to: "/dashboard/users", label: "Accounts" }]
            : []),
        ]}
      />
      <Outlet />
    </>
  );
}
export function AnalyticsPage() {
  const query = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api<Analytics>("/admin/analytics"),
  });
  return (
    <>
      <PageHeading
        eyebrow="PASTOR & ADMIN DASHBOARD"
        title="Care for a growing community."
      >
        A view of the messages, daily rhythms, and conversations taking root.
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <AnalyticsCards stats={query.data.data} />
      )}
      <div className="grid gap-4 sm:grid-cols-2 mt-7">
        <Link
          className="panel p-6 flex justify-between items-center text-link"
          to="/dashboard/sermons"
        >
          Manage sermons
          <ArrowRight size={18} />
        </Link>
        <Link
          className="panel p-6 flex justify-between items-center text-link"
          to="/dashboard/plans"
        >
          Manage weekly plans
          <ArrowRight size={18} />
        </Link>
      </div>
    </>
  );
}
function AnalyticsCards({ stats: s }: { stats: Analytics }) {
  const metrics = [
    ["Community members", s.users.total],
    ["Published messages", s.sermons.published],
    ["Study plans", s.studyPlans.total],
    ["Completed user lessons", s.studyPlans.completedLessons],
  ] as const;
  const events = [
    ["Unique sermon views", s.engagement.uniqueViews],
    ["Unique audio listens", s.engagement.uniqueListens],
    ["Saved bookmarks", s.engagement.bookmarks],
    ["Discussion posts", s.engagement.discussionPosts],
  ] as const;
  const maximum = Math.max(1, ...events.map((e) => e[1]));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, count]) => (
          <div className="panel p-6" key={label}>
            <p className="text-xs text-muted">{label}</p>
            <p className="font-serif text-4xl text-accent mt-3">
              {count.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2 mt-6">
        <section className="panel p-6">
          <h2 className="font-serif text-2xl mb-6">Engagement at a glance</h2>
          {events.map(([label, count]) => (
            <div className="mb-5" key={label}>
              <div className="flex justify-between gap-4 text-sm mb-2">
                <span>{label}</span>
                <strong>{count.toLocaleString()}</strong>
              </div>
              <div className="h-2 bg-paper rounded-full">
                <div
                  className="h-2 bg-sage rounded-full"
                  style={{ width: `${(count / maximum) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted leading-relaxed">
            Lifetime counts of retained records. Views/listens are counted once
            per user and sermon, not playback duration.
          </p>
        </section>
        <section className="panel p-6">
          <h2 className="font-serif text-2xl mb-6">The wider picture</h2>
          <dl className="metric-list">
            <div>
              <dt>Draft sermons</dt>
              <dd>{s.sermons.draft}</dd>
            </div>
            <div>
              <dt>Archived sermons</dt>
              <dd>{s.sermons.archived}</dd>
            </div>
            <div>
              <dt>Active / inactive accounts</dt>
              <dd>
                {s.users.active} / {s.users.inactive}
              </dd>
            </div>
            <div>
              <dt>Daily lessons</dt>
              <dd>{s.studyPlans.dailyLessons}</dd>
            </div>
            <div>
              <dt>Fellowship groups</dt>
              <dd>{s.engagement.groups}</dd>
            </div>
            <div>
              <dt>Journal entries (count only)</dt>
              <dd>{s.engagement.journalEntries}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted mt-6">
            Private journal content is never shown in this dashboard.
          </p>
        </section>
      </div>
    </>
  );
}
export function ManageSermons() {
  const [params, setParams] = useSearchParams();
  const q = new URLSearchParams(params);
  q.set("limit", "12");
  const query = useQuery({
    queryKey: ["manage-sermons", q.toString()],
    queryFn: () => api<Sermon[]>(`/sermons?${q}`),
  });
  const archive = useAction(
    (id: string) => api<Sermon>(`/sermons/${id}/archive`, { method: "POST" }),
    [
      ["manage-sermons"],
      ["sermons"],
      ["sermon"],
      ["plans"],
      ["analytics"],
      ["bookmarks"],
    ],
  );
  return (
    <>
      <PageHeading
        eyebrow="CONTENT MANAGEMENT"
        title="Messages with a purpose."
      />
      <div className="flex gap-3 flex-wrap mb-6">
        <Link to="/dashboard/sermons/new" className="btn-primary">
          <Plus size={16} />
          New sermon
        </Link>
        <label className="sr-only" htmlFor="status-filter">
          Filter by status
        </label>
        <select
          id="status-filter"
          value={params.get("status") ?? ""}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            e.target.value
              ? next.set("status", e.target.value)
              : next.delete("status");
            next.delete("page");
            setParams(next);
          }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <ListSearch placeholder="Search sermons…" />
      <ActionError error={archive.error} />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.data.length ? (
        <Empty title="A message is waiting to be written.">
          <p>No sermons match this view.</p>
        </Empty>
      ) : (
        <>
          <div className="space-y-3">
            {query.data.data.map((s) => (
              <article
                key={s.id}
                className="panel p-5 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <span className="badge">{s.status}</span>
                  <h2 className="font-serif text-2xl mt-2">{s.title}</h2>
                  <p className="text-xs text-muted mt-2">
                    {s.preacher} · {s.passage}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    className="btn-secondary"
                    to={`/dashboard/sermons/${s.id}/edit`}
                  >
                    Edit sermon
                  </Link>
                  {s.status !== "archived" && (
                    <ConfirmButton
                      message="Archive this sermon? Members will no longer see it or its attached study plans."
                      disabled={archive.isPending}
                      onConfirm={() => archive.mutate(s.id)}
                    >
                      Archive
                    </ConfirmButton>
                  )}
                </div>
              </article>
            ))}
          </div>
          <ListPages data={query.data} />
        </>
      )}
    </>
  );
}
export function SermonEditor() {
  const { sermonId } = useParams();
  const query = useQuery({
    queryKey: ["sermon", sermonId],
    queryFn: () => api<Sermon>(`/sermons/${sermonId}`),
    enabled: !!sermonId,
  });
  if (sermonId && query.isPending) return <Loading />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return <SermonForm key={sermonId ?? "new"} sermon={query.data?.data} />;
}
function SermonForm({ sermon }: { sermon?: Sermon }) {
  const navigate = useNavigate();
  const keys = [
    ["manage-sermons"],
    ["sermons"],
    ["sermon"],
    ["sermon-picker"],
    ["sermon-selection"],
    ["plans"],
    ["analytics"],
    ["bookmarks"],
  ];
  const save = useAction(
    (body: unknown) =>
      api<Sermon>(
        sermon ? `/sermons/${sermon.id}` : "/sermons",
        send(sermon ? "PATCH" : "POST", body),
      ),
    keys,
    () => navigate("/dashboard/sermons"),
  );
  const remove = useAction(
    () => api<void>(`/sermons/${sermon!.id}`, { method: "DELETE" }),
    keys,
    () => navigate("/dashboard/sermons"),
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(f);
    body.audioUrl = f.get("audioUrl") || null;
    body.videoUrl = f.get("videoUrl") || null;
    body.tags = String(f.get("tags"))
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    save.mutate(body);
  }
  return (
    <>
      <Back to="/dashboard/sermons">Manage sermons</Back>
      <PageHeading
        eyebrow="CONTENT MANAGEMENT"
        title={sermon ? "Shape the message." : "A new word for the week."}
      />
      <form className="panel p-6 sm:p-8 space-y-5" onSubmit={submit}>
        <label className="field">
          Sermon title
          <input
            name="title"
            required
            maxLength={255}
            defaultValue={sermon?.title}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            Preacher
            <input
              name="preacher"
              required
              maxLength={150}
              defaultValue={sermon?.preacher}
            />
          </label>
          <label className="field">
            Scripture passage
            <input
              name="passage"
              required
              maxLength={150}
              defaultValue={sermon?.passage}
            />
          </label>
          <label className="field">
            Sermon date
            <input
              name="sermonDate"
              type="date"
              required
              defaultValue={sermon?.sermonDate}
            />
          </label>
          <label className="field">
            Publication status
            <select name="status" defaultValue={sermon?.status ?? "draft"}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        <label className="field">
          Summary
          <textarea
            aria-label="Summary"
            name="summary"
            rows={3}
            maxLength={5000}
            defaultValue={sermon?.summary ?? ""}
          />
        </label>
        <label className="field">
          Full message
          <textarea
            aria-label="Full message"
            name="content"
            rows={12}
            maxLength={100000}
            defaultValue={sermon?.content ?? ""}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            Audio URL
            <input
              name="audioUrl"
              type="url"
              maxLength={2048}
              defaultValue={sermon?.audioUrl ?? ""}
              placeholder="https://…"
            />
          </label>
          <label className="field">
            Video URL
            <input
              name="videoUrl"
              type="url"
              maxLength={2048}
              defaultValue={sermon?.videoUrl ?? ""}
              placeholder="https://…"
            />
          </label>
        </div>
        <label className="field">
          Tags (comma-separated, up to 20)
          <input name="tags" defaultValue={sermon?.tags.join(", ")} />
        </label>
        <ActionError error={save.error ?? remove.error} />
        <div className="flex gap-3 flex-wrap">
          <button
            className="btn-primary"
            disabled={save.isPending || remove.isPending}
          >
            {save.isPending ? "Saving…" : "Save sermon"}
          </button>
          <Link className="btn-secondary" to="/dashboard/sermons">
            Cancel
          </Link>
          {sermon && (
            <ConfirmButton
              message="Permanently delete this sermon? Its bookmarks and engagement will be removed; study plans will be detached. Archiving is available if you want to keep it."
              disabled={save.isPending || remove.isPending}
              onConfirm={() => remove.mutate()}
            >
              Delete sermon
            </ConfirmButton>
          )}
        </div>
      </form>
    </>
  );
}
export function ManagePlans() {
  const [params] = useSearchParams();
  const q = new URLSearchParams(params);
  q.set("scope", "manage");
  q.set("limit", "12");
  const query = useQuery({
    queryKey: ["manage-plans", q.toString()],
    queryFn: () => api<Plan[]>(`/study-plans?${q}`),
  });
  return (
    <>
      <PageHeading
        eyebrow="WEEKLY PLAN MANAGEMENT"
        title="Give the message room to grow."
      />
      <Link className="btn-primary mb-6" to="/dashboard/plans/new">
        <Plus size={16} />
        New study plan
      </Link>
      <ListSearch placeholder="Search study plans…" />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.data.length ? (
        <Empty title="Build a daily rhythm.">
          <p>Create a plan and add lessons for days 1–7.</p>
        </Empty>
      ) : (
        <>
          <div className="sermon-grid">
            {query.data.data.map((p) => (
              <Link
                key={p.id}
                className="panel p-6 hover:border-sage"
                to={`/dashboard/plans/${p.id}/edit`}
              >
                <h2 className="font-serif text-2xl">{p.title}</h2>
                <p className="text-sm text-muted mt-3 line-clamp-3">
                  {p.description}
                </p>
                <p className="text-xs text-accent mt-5">
                  {p.sermon?.title ?? "Not attached to a sermon"}
                </p>
                <span className="text-link text-sm mt-5 block">
                  Edit plan & lessons →
                </span>
              </Link>
            ))}
          </div>
          <ListPages data={query.data} />
        </>
      )}
    </>
  );
}
export function PlanEditor() {
  const { planId } = useParams();
  const query = useQuery({
    queryKey: ["plan", planId],
    queryFn: () => api<Plan>(`/study-plans/${planId}`),
    enabled: !!planId,
  });
  if (planId && query.isPending) return <Loading />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <>
      <PlanForm key={planId ?? "new"} plan={query.data?.data} />
      {query.data && (
        <section className="mt-8">
          <h2 className="font-serif text-3xl mb-5">The daily lessons</h2>
          <div className="space-y-5">
            {query.data.data.dailyLessons?.map((l) => (
              <LessonForm key={l.id} lesson={l} planId={planId!} />
            ))}
            {(query.data.data.dailyLessons?.length ?? 0) < 7 && (
              <LessonForm planId={planId!} />
            )}
          </div>
        </section>
      )}
    </>
  );
}
function PlanForm({ plan }: { plan?: Plan }) {
  const navigate = useNavigate();
  const [sermonId, setSermonId] = useState(plan?.sermonId ?? "");
  const [notice, setNotice] = useState("");
  const keys = [
    ["manage-plans"],
    ["plans"],
    ["plan", plan?.id],
    ["sermon-plans"],
    ["analytics"],
  ];
  const save = useAction(
    (body: unknown) =>
      api<Plan>(
        plan ? `/study-plans/${plan.id}` : "/study-plans",
        send(plan ? "PATCH" : "POST", body),
      ),
    keys,
    (value) => {
      if (!plan) navigate(`/dashboard/plans/${value.data.id}/edit`);
      else setNotice("Plan saved.");
    },
  );
  const attach = useAction(
    () =>
      api<Plan>(`/study-plans/${plan!.id}/sermon`, send("PUT", { sermonId })),
    keys,
    () => setNotice("Sermon attachment saved."),
  );
  const remove = useAction(
    () => api<void>(`/study-plans/${plan!.id}`, { method: "DELETE" }),
    keys,
    () => navigate("/dashboard/plans"),
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice("");
    const f = new FormData(e.currentTarget);
    save.mutate({
      title: f.get("title"),
      description: String(f.get("description")) || (plan ? null : undefined),
      ...(!plan
        ? {
            ...(sermonId ? { sermonId } : {}),
            dailyLessons: [
              {
                day: 1,
                title: f.get("lessonTitle"),
                content: f.get("lessonContent"),
              },
            ],
          }
        : {}),
    });
  }
  return (
    <>
      <Back to="/dashboard/plans">Manage study plans</Back>
      <PageHeading
        eyebrow="WEEKLY PLAN MANAGEMENT"
        title={plan ? "Nurture a daily rhythm." : "Start with one small step."}
      />
      <form className="panel p-6 space-y-5" onSubmit={submit}>
        <label className="field">
          Plan title
          <input
            name="title"
            maxLength={255}
            required
            defaultValue={plan?.title}
          />
        </label>
        <label className="field">
          Plan description
          <textarea
            aria-label="Plan description"
            name="description"
            maxLength={5000}
            rows={3}
            defaultValue={plan?.description ?? ""}
          />
        </label>
        {!plan && (
          <>
            <SermonPicker staff value={sermonId} onChange={setSermonId} />
            <p className="text-sm text-muted">
              Start with day 1. Add the remaining days after creating the plan.
            </p>
            <label className="field">
              First lesson title
              <input name="lessonTitle" required maxLength={255} />
            </label>
            <label className="field">
              First lesson content
              <textarea
                name="lessonContent"
                required
                maxLength={20000}
                rows={5}
              />
            </label>
          </>
        )}
        <ActionError error={save.error ?? remove.error} />
        <div className="flex gap-3 flex-wrap">
          <button
            className="btn-primary"
            disabled={save.isPending || remove.isPending}
          >
            {save.isPending ? "Saving…" : "Save plan"}
          </button>
          {plan && (
            <ConfirmButton
              message="Delete this plan, every daily lesson and all member completion records for it?"
              onConfirm={() => remove.mutate()}
              disabled={remove.isPending || save.isPending}
            >
              Delete plan
            </ConfirmButton>
          )}
        </div>
      </form>
      {plan && (
        <form
          className="panel p-6 mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice("");
            attach.mutate();
          }}
        >
          <h2 className="font-serif text-2xl">Attach to a sermon</h2>
          <SermonPicker
            staff
            required
            value={sermonId}
            onChange={setSermonId}
          />
          <ActionError error={attach.error} />
          <button
            className="btn-secondary"
            disabled={attach.isPending || !sermonId}
          >
            Save attachment
          </button>
        </form>
      )}
      {notice && (
        <p role="status" className="notice mt-4">
          {notice}
        </p>
      )}
    </>
  );
}
function LessonForm({ planId, lesson }: { planId: string; lesson?: Lesson }) {
  const [notice, setNotice] = useState("");
  const [reset, setReset] = useState(0);
  const keys = [
    ["plan", planId],
    ["plans"],
    ["manage-plans"],
    ["progress", planId],
    ["lesson", planId],
    ["analytics"],
  ];
  const save = useAction(
    (body: unknown) =>
      api<Lesson>(
        lesson
          ? `/daily-lessons/${lesson.id}`
          : `/study-plans/${planId}/daily-lessons`,
        send(lesson ? "PATCH" : "POST", body),
      ),
    keys,
    () => {
      setNotice(lesson ? "Lesson saved." : "Lesson added.");
      if (!lesson) setReset((v) => v + 1);
    },
  );
  const remove = useAction(
    () => api<void>(`/daily-lessons/${lesson!.id}`, { method: "DELETE" }),
    keys,
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setNotice("");
    save.mutate({
      day: Number(f.get("day")),
      title: f.get("title"),
      passage: f.get("passage") || null,
      content: f.get("content"),
    });
  }
  return (
    <form key={reset} className="panel p-6 space-y-4" onSubmit={submit}>
      <h3 className="font-serif text-2xl">
        {lesson ? `Day ${lesson.day}: ${lesson.title}` : "Add a daily lesson"}
      </h3>
      <div className="form-grid">
        <label className="field">
          Day number
          <input
            name="day"
            type="number"
            min={1}
            max={7}
            required
            defaultValue={lesson?.day}
          />
        </label>
        <label className="field">
          Lesson title
          <input
            name="title"
            required
            maxLength={255}
            defaultValue={lesson?.title}
          />
        </label>
      </div>
      <label className="field">
        Lesson scripture
        <input
          name="passage"
          maxLength={150}
          defaultValue={lesson?.passage ?? ""}
        />
      </label>
      <label className="field">
        Lesson content
        <textarea
          aria-label="Lesson content"
          name="content"
          rows={6}
          required
          maxLength={20000}
          defaultValue={lesson?.content}
        />
      </label>
      <ActionError error={save.error ?? remove.error} />
      {notice && (
        <p role="status" className="text-sm text-accent">
          {notice}
        </p>
      )}
      <div className="flex gap-3">
        <button
          className="btn-primary"
          disabled={save.isPending || remove.isPending}
        >
          {lesson ? "Save lesson" : "Add lesson"}
        </button>
        {lesson && (
          <ConfirmButton
            message="Delete this lesson and all member progress for it?"
            onConfirm={() => remove.mutate()}
            disabled={save.isPending || remove.isPending}
          >
            Delete lesson
          </ConfirmButton>
        )}
      </div>
    </form>
  );
}
export function UsersPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const page = params.get("page") ?? "1";
  const query = useQuery({
    queryKey: ["admin-users", page],
    queryFn: () => api<User[]>(`/admin/users?page=${page}&limit=12`),
    enabled: user?.role === "admin",
  });
  if (user?.role !== "admin")
    return <ErrorState error={new Error("Only admins can manage accounts.")} />;
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT MANAGEMENT"
        title="Care for your community."
      >
        Assign roles and manage account access. Deactivation preserves a
        member’s content.
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="space-y-4">
            {query.data.data.map((u) => (
              <AccountCard
                key={`${u.id}-${u.role}-${u.isActive}`}
                account={u}
                self={u.id === user.id}
              />
            ))}
          </div>
          <ListPages data={query.data} />
        </>
      )}
    </>
  );
}
function AccountCard({ account: u, self }: { account: User; self: boolean }) {
  const [role, setRole] = useState(u.role);
  const changeRole = useAction(
    () => api<User>(`/admin/users/${u.id}/role`, send("PATCH", { role })),
    [["admin-users"], ["analytics"]],
  );
  const status = useAction(
    () =>
      api<User>(
        `/admin/users/${u.id}/status`,
        send("PATCH", { isActive: !u.isActive }),
      ),
    [["admin-users"], ["analytics"]],
  );
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-serif text-2xl">
            {u.name}
            {self ? " (you)" : ""}
          </h2>
          <p className="text-sm text-muted mt-2 break-all">{u.email}</p>
          <span className="badge mt-3">
            {u.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="field">
            Role for {u.name}
            <select
              value={role}
              disabled={self || changeRole.isPending || status.isPending}
              onChange={(e) => setRole(e.target.value as User["role"])}
            >
              <option value="member">Member</option>
              <option value="leader">Pastor / leader</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <ConfirmButton
            message={`Change ${u.name}’s role to ${role}? Permissions change immediately.`}
            disabled={
              self ||
              role === u.role ||
              changeRole.isPending ||
              status.isPending
            }
            onConfirm={() => changeRole.mutate()}
          >
            Apply role
          </ConfirmButton>
          <ConfirmButton
            message={`${u.isActive ? "Deactivate" : "Reactivate"} ${u.name}’s account? ${u.isActive ? "Existing sessions will stop working immediately." : "They will be able to sign in again."}`}
            disabled={self || status.isPending || changeRole.isPending}
            onConfirm={() => status.mutate()}
          >
            {u.isActive ? "Deactivate" : "Reactivate"}
          </ConfirmButton>
        </div>
      </div>
      {self && (
        <p className="text-xs text-muted mt-4 flex items-center gap-2">
          <ShieldCheck size={14} />
          You can’t deactivate or change your own admin role here.
        </p>
      )}
      <ActionError error={changeRole.error ?? status.error} />
    </article>
  );
}
