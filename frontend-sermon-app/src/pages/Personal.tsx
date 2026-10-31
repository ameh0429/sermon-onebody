import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark as BookmarkIcon, LockKeyhole, Plus } from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api, send } from "../api";
import type { Bookmark, JournalEntry } from "../types";
import {
  Back,
  Empty,
  ErrorState,
  formatDate,
  Loading,
  PageHeading,
} from "../ui";
import {
  ActionError,
  ConfirmButton,
  FeatureTabs,
  ListPages,
  SermonPicker,
  useAction,
} from "../features";
const tabs = [
  { to: "/personal", label: "Bookmarks" },
  { to: "/personal/journal", label: "Private journal" },
];
export function BookmarkToggle({ sermonId }: { sermonId: string }) {
  const saved = useQuery({
    queryKey: ["bookmarks", "sermon", sermonId],
    queryFn: () => api<Bookmark[]>(`/bookmarks?sermonId=${sermonId}&limit=1`),
  });
  const bookmarked = !!saved.data?.data.length;
  const action = useAction(async () => {
    if (bookmarked)
      await api<void>(`/bookmarks/${sermonId}`, { method: "DELETE" });
    else await api<Bookmark>("/bookmarks", send("POST", { sermonId }));
  }, [["bookmarks"]]);
  return (
    <div className="mb-6">
      <button
        className="btn-secondary"
        onClick={() => action.mutate()}
        disabled={saved.isPending || action.isPending || saved.isError}
      >
        <BookmarkIcon size={17} fill={bookmarked ? "currentColor" : "none"} />
        {saved.isPending
          ? "Loading bookmark…"
          : bookmarked
            ? "Remove bookmark"
            : "Bookmark sermon"}
      </button>
      <ActionError error={action.error} />
      {saved.isError && (
        <ErrorState error={saved.error} retry={() => void saved.refetch()} />
      )}
    </div>
  );
}
export function BookmarksPage() {
  const [params] = useSearchParams();
  const page = params.get("page") ?? "1";
  const query = useQuery({
    queryKey: ["bookmarks", page],
    queryFn: () => api<Bookmark[]>(`/bookmarks?page=${page}&limit=12`),
  });
  const remove = useAction(
    (id: string) => api<void>(`/bookmarks/${id}`, { method: "DELETE" }),
    [["bookmarks"]],
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR PERSONAL SPACE"
        title="Keep a little truth close."
      >
        Messages worth returning to, and space for your own reflections.
      </PageHeading>
      <FeatureTabs links={tabs} />
      <ActionError error={remove.error} />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.data.length ? (
        <Empty title="A place for your saved messages.">
          <p>Bookmark a sermon from its message page to find it here.</p>
          <Link to="/sermons" className="text-link mt-4 inline-block">
            Browse sermons
          </Link>
        </Empty>
      ) : (
        <>
          <div className="sermon-grid">
            {query.data.data.map((b) => (
              <article className="panel p-6" key={b.id}>
                <BookmarkIcon className="text-sage mb-5" size={23} />
                <Link
                  to={`/sermons/${b.sermonId}`}
                  className="font-serif text-2xl text-link"
                >
                  {b.sermon.title}
                </Link>
                <p className="text-sm text-muted mt-3">
                  {b.sermon.preacher} · {b.sermon.passage}
                </p>
                <button
                  className="text-link text-xs mt-5"
                  onClick={() => remove.mutate(b.sermonId)}
                  disabled={remove.isPending}
                >
                  Remove bookmark
                </button>
              </article>
            ))}
          </div>
          <ListPages data={query.data} />
        </>
      )}
    </>
  );
}
export function JournalPage() {
  const [params] = useSearchParams();
  const page = params.get("page") ?? "1";
  const query = useQuery({
    queryKey: ["journal", page],
    queryFn: () => api<JournalEntry[]>(`/journal?page=${page}&limit=12`),
  });
  return (
    <>
      <PageHeading
        eyebrow="YOUR PRIVATE JOURNAL"
        title="Make space to reflect."
      >
        Your words, your prayers, your daily walk. Entries are private to you.
      </PageHeading>
      <FeatureTabs links={tabs} />
      <Link to="/personal/journal/new" className="btn-primary mb-6">
        <Plus size={17} />
        New reflection
      </Link>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.data.length ? (
        <Empty title="Start with a thought.">
          <p>You don’t need the perfect words. Write what’s on your heart.</p>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4">
            {query.data.data.map((entry) => (
              <Link
                key={entry.id}
                className="panel p-6 hover:border-sage"
                to={`/personal/journal/${entry.id}`}
              >
                <div className="flex items-center gap-2 text-xs text-muted">
                  <LockKeyhole size={13} />
                  {entry.isShared
                    ? "Previously shared entry"
                    : "Private"} · {formatDate(entry.updatedAt)}
                </div>
                <h2 className="font-serif text-2xl mt-3">{entry.title}</h2>
                <p className="mt-3 text-sm text-muted line-clamp-2 whitespace-pre-wrap">
                  {entry.content}
                </p>
              </Link>
            ))}
          </div>
          <ListPages data={query.data} />
        </>
      )}
    </>
  );
}
export function JournalEditor() {
  const { entryId } = useParams();
  const [params] = useSearchParams();
  const query = useQuery({
    queryKey: ["journal-entry", entryId],
    queryFn: () => api<JournalEntry>(`/journal/${entryId}`),
    enabled: !!entryId,
  });
  if (entryId && query.isPending) return <Loading />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <JournalForm
      key={entryId ?? "new"}
      entry={query.data?.data}
      initialSermon={params.get("sermonId") ?? ""}
    />
  );
}
function JournalForm({
  entry,
  initialSermon,
}: {
  entry?: JournalEntry;
  initialSermon: string;
}) {
  const navigate = useNavigate();
  const [sermonId, setSermonId] = useState(entry?.sermonId ?? initialSermon);
  const save = useAction(
    (body: unknown) =>
      api<JournalEntry>(
        entry ? `/journal/${entry.id}` : "/journal",
        send(entry ? "PATCH" : "POST", body),
      ),
    [["journal"], ["journal-entry"]],
    () => navigate("/personal/journal"),
  );
  const remove = useAction(
    () => api<void>(`/journal/${entry!.id}`, { method: "DELETE" }),
    [["journal"]],
    () => navigate("/personal/journal"),
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      title: f.get("title"),
      content: f.get("content"),
      sermonId: sermonId || null,
      isShared: false,
    });
  }
  return (
    <>
      <Back to="/personal/journal">Private journal</Back>
      <PageHeading
        eyebrow="BETWEEN YOU AND GOD"
        title={entry ? "Return to your reflection." : "What’s on your heart?"}
      >
        Your writing is saved only when you choose Save. This screen keeps saved
        entries private.
      </PageHeading>
      {entry?.isShared && (
        <p className="notice mb-5">
          This entry was shared previously. Saving here will make it private and
          remove group access.
        </p>
      )}
      <form onSubmit={submit} className="panel p-6 sm:p-8 space-y-6">
        <label className="field">
          Reflection title
          <input
            name="title"
            defaultValue={entry?.title}
            maxLength={255}
            required
            placeholder="A thought to return to"
          />
        </label>
        <label className="field">
          Your reflection
          <textarea
            aria-label="Your reflection"
            name="content"
            defaultValue={entry?.content}
            maxLength={50000}
            required
            rows={12}
            placeholder="Write freely. This space is yours."
          />
        </label>
        <SermonPicker value={sermonId} onChange={setSermonId} />
        <ActionError error={save.error ?? remove.error} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn-primary"
            disabled={save.isPending || remove.isPending}
          >
            {save.isPending ? "Saving…" : "Save reflection"}
          </button>
          <Link to="/personal/journal" className="btn-secondary">
            Cancel
          </Link>
          {entry && (
            <ConfirmButton
              message="Delete this reflection permanently?"
              disabled={save.isPending || remove.isPending}
              onConfirm={() => remove.mutate()}
            >
              Delete reflection
            </ConfirmButton>
          )}
        </div>
      </form>
    </>
  );
}
