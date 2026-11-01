import { BookmarkToggle } from "./Personal";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Headphones,
  Play,
  Search,
  SlidersHorizontal,
  Sprout,
  Video,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, safeMediaUrl, send } from "../api";
import {
  Back,
  Empty,
  ErrorState,
  formatDate,
  Loading,
  PageHeading,
  Pagination,
} from "../ui";
import type { Plan, Sermon } from "../types";
export function SermonLibrary() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(false);
  const queryString = new URLSearchParams(params);
  queryString.set("limit", "9");
  queryString.set("status", "published");
  const sermons = useQuery({
    queryKey: ["sermons", queryString.toString()],
    queryFn: () => api<Sermon[]>(`/sermons?${queryString}`),
  });
  const filterCount = ["preacher", "tag", "from", "to"].filter((k) =>
    params.has(k),
  ).length;
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of data)
      if (String(value).trim()) next.set(key, String(value).trim());
    setParams(next);
  }
  function changePage(page: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <>
      <PageHeading eyebrow="THE SERMON LIBRARY" title="A word for your season.">
        Messages to meet you where you are, and help you take your next step.
      </PageHeading>
      <section className="library-hero">
        <div className="relative z-10">
          <span className="hero-label">
            <span className="h-1.5 w-1.5 rounded-full bg-peach" />
            LISTEN. REFLECT. LIVE IT OUT.
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl leading-tight mt-5">
            Let the Word take root.
          </h2>
          <p className="mt-4 text-white/85 max-w-sm text-sm leading-relaxed">
            More than a Sunday message. Find a truth to carry with you into the
            everyday.
          </p>
          <Link
            to="/growth"
            className="inline-flex items-center gap-3 mt-6 text-sm font-semibold text-white"
          >
            Explore weekly growth
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="hero-landscape" aria-hidden="true">
          <div className="sun" />
          <div className="hill hill-one" />
          <div className="hill hill-two" />
          <Sprout
            size={105}
            strokeWidth={0.7}
            className="absolute bottom-3 right-10 text-white/30"
          />
        </div>
      </section>
      <div className="section-heading">
        <h2 className="font-serif text-2xl">Explore the messages</h2>
        <span className="text-xs text-muted">
          {sermons.data
            ? `${sermons.data.meta?.total ?? sermons.data.data.length} messages`
            : "Made for your daily walk"}
        </span>
      </div>
      <form className="search-panel" onSubmit={search} key={params.toString()}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grow basis-60">
            <label className="sr-only" htmlFor="sermon-search">
              Search sermons
            </label>
            <div className="search-input">
              <Search size={18} />
              <input
                id="sermon-search"
                name="q"
                placeholder="Search a message, topic, or passage…"
                maxLength={200}
                defaultValue={params.get("q") ?? ""}
              />
              <button className="text-link text-sm shrink-0" type="submit">
                Search
              </button>
            </div>
          </div>
          <button
            className={`btn-secondary ${filterCount ? "border-secondary!" : ""}`}
            type="button"
            aria-expanded={filters}
            aria-controls="sermon-filters"
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={16} />
            Filters
            {filterCount > 0 && (
              <span className="filter-count">{filterCount}</span>
            )}
            <ChevronDown size={14} />
          </button>
          <label className="sr-only" htmlFor="sermon-sort">
            Sort sermons
          </label>
          <select
            id="sermon-sort"
            name="order"
            defaultValue={params.get("order") ?? "desc"}
            aria-label="Sort sermons"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
        <div
          id="sermon-filters"
          className={filters ? "filter-fields" : "hidden"}
        >
          <label className="field">
            Preacher
            <input
              name="preacher"
              placeholder="Any preacher"
              defaultValue={params.get("preacher") ?? ""}
              maxLength={150}
            />
          </label>
          <label className="field">
            Tag
            <input
              name="tag"
              placeholder="e.g. grace"
              defaultValue={params.get("tag") ?? ""}
              maxLength={50}
            />
          </label>
          <label className="field">
            From date
            <input
              name="from"
              type="date"
              defaultValue={params.get("from") ?? ""}
            />
          </label>
          <label className="field">
            To date
            <input
              name="to"
              type="date"
              defaultValue={params.get("to") ?? ""}
            />
          </label>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <button type="submit" className="text-link text-xs">
            Apply search & filters
          </button>
          {params.toString() && (
            <button
              type="button"
              onClick={() => setParams({})}
              className="text-xs text-muted underline underline-offset-4"
            >
              Clear all
            </button>
          )}
        </div>
      </form>
      {sermons.isPending ? (
        <Loading label="Finding messages for your week…" />
      ) : sermons.isError ? (
        <ErrorState
          error={sermons.error}
          retry={() => void sermons.refetch()}
        />
      ) : sermons.data.data.length === 0 ? (
        <Empty title="No messages found.">
          <p>Try a different search or clear your filters.</p>
          {params.toString() && (
            <button onClick={() => setParams({})} className="text-link mt-4">
              Clear filters
            </button>
          )}
        </Empty>
      ) : (
        <>
          <div className="sermon-grid">
            {sermons.data.data.map((sermon, index) => (
              <SermonCard key={sermon.id} sermon={sermon} index={index} />
            ))}
          </div>
          <Pagination
            page={sermons.data.meta?.page ?? 1}
            totalPages={sermons.data.meta?.totalPages ?? 1}
            change={changePage}
          />
        </>
      )}
    </>
  );
}
function SermonCard({ sermon, index }: { sermon: Sermon; index: number }) {
  return (
    <Link to={`/sermons/${sermon.id}`} className="sermon-card group">
      <div className={`sermon-art art-${index % 3}`} aria-hidden="true">
        <div className="art-orb" />
        <div className="art-hill" />
        <span className="art-caption">{sermon.passage}</span>
        <span className="art-play">
          {sermon.audioUrl || sermon.videoUrl ? (
            <Play size={18} fill="currentColor" />
          ) : (
            <BookOpen size={20} />
          )}
        </span>
      </div>
      <div className="p-5 flex flex-col grow">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow text-[10px]!">
            {sermon.tags[0] ?? "THE WORD"}
          </span>
          <span className="text-[11px] text-muted">
            {formatDate(sermon.sermonDate)}
          </span>
        </div>
        <h3 className="font-serif text-[23px] leading-snug mt-3 group-hover:text-accent">
          {sermon.title}
        </h3>
        <p className="text-xs text-muted mt-2">{sermon.preacher}</p>
        {sermon.summary && (
          <p className="text-sm text-muted mt-3 line-clamp-2 leading-relaxed">
            {sermon.summary}
          </p>
        )}
        <div className="mt-auto pt-5 flex items-center justify-between text-xs text-accent">
          <span className="flex items-center gap-2">
            {sermon.audioUrl ? (
              <>
                <Headphones size={14} />
                Listen & reflect
              </>
            ) : sermon.videoUrl ? (
              <>
                <Video size={14} />
                Watch message
              </>
            ) : (
              <>
                <BookOpen size={14} />
                Read message
              </>
            )}
          </span>
          <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}
function youtubeEmbed(url: string | null) {
  if (!url) return null;
  const parsed = new URL(url);
  let id = "";
  if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
      parsed.hostname,
    )
  )
    id =
      parsed.searchParams.get("v") ??
      (parsed.pathname.startsWith("/embed/")
        ? parsed.pathname.split("/")[2]
        : "");
  if (parsed.hostname === "youtu.be") id = parsed.pathname.slice(1);
  return /^[\w-]{11}$/.test(id)
    ? `https://www.youtube-nocookie.com/embed/${id}`
    : null;
}
function Media({ sermon }: { sermon: Sermon }) {
  const audio = safeMediaUrl(sermon.audioUrl),
    video = safeMediaUrl(sermon.videoUrl),
    embed = youtubeEmbed(video);
  const [failed, setFailed] = useState({ audio: false, video: false });
  const [mode, setMode] = useState<"audio" | "video">(
    audio ? "audio" : "video",
  );
  if (!audio && !video) return null;
  function listen() {
    void api(
      `/sermons/${sermon.id}/engagement`,
      send("POST", { event: "listen" }),
    ).catch(() => {});
  }
  return (
    <section className="panel p-5 sm:p-6 mb-6" aria-label="Sermon media">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="font-serif text-xl">Make a little room to listen.</h2>
        <div className="media-tabs">
          {audio && (
            <button
              aria-pressed={mode === "audio"}
              onClick={() => setMode("audio")}
            >
              <Headphones size={14} />
              Audio
            </button>
          )}
          {video && (
            <button
              aria-pressed={mode === "video"}
              onClick={() => setMode("video")}
            >
              <Video size={14} />
              Video
            </button>
          )}
        </div>
      </div>
      {mode === "audio" && audio && (
        <>
          <audio
            className="w-full"
            controls
            preload="metadata"
            src={audio}
            onPlay={listen}
            onError={() => setFailed((s) => ({ ...s, audio: true }))}
          >
            Your browser does not support audio playback.
          </audio>
          {failed.audio && (
            <p className="text-sm text-muted mt-3" role="status">
              This audio could not be played.{" "}
              <a
                className="text-link"
                href={audio}
                target="_blank"
                rel="noreferrer"
              >
                Open the audio source
              </a>
              .
            </p>
          )}
        </>
      )}
      {mode === "video" && video && (
        <>
          {embed ? (
            <iframe
              className="w-full aspect-video rounded-xl"
              src={embed}
              title={`${sermon.title} video`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <video
              className="w-full aspect-video rounded-xl bg-ink"
              controls
              preload="metadata"
              src={video}
              onError={() => setFailed((s) => ({ ...s, video: true }))}
            />
          )}
          {failed.video && (
            <p className="text-sm text-muted mt-3" role="status">
              This video could not be played.{" "}
              <a
                className="text-link"
                href={video}
                target="_blank"
                rel="noreferrer"
              >
                Open the video source
              </a>
              .
            </p>
          )}
        </>
      )}
    </section>
  );
}
export function SermonDetail() {
  const { sermonId } = useParams();
  const sermon = useQuery({
    queryKey: ["sermon", sermonId],
    queryFn: () => api<Sermon>(`/sermons/${sermonId}`),
  });
  const plans = useQuery({
    queryKey: ["sermon-plans", sermonId],
    queryFn: () => api<Plan[]>(`/sermons/${sermonId}/study-plans`),
    enabled: !!sermon.data,
  });
  useEffect(() => {
    if (sermon.data?.data.status === "published")
      void api(
        `/sermons/${sermonId}/engagement`,
        send("POST", { event: "view" }),
      ).catch(() => {});
  }, [sermonId, sermon.data?.data.status]);
  if (sermon.isPending) return <Loading label="Opening the message…" />;
  if (sermon.isError)
    return (
      <>
        <Back to="/sermons">Sermon library</Back>
        <ErrorState error={sermon.error} retry={() => void sermon.refetch()} />
      </>
    );
  const s = sermon.data.data;
  return (
    <>
      <Back to="/sermons">Sermon library</Back>
      <header className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          {s.tags.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
        </div>
        <h1 className="page-title max-w-3xl">{s.title}</h1>
        <p className="text-muted mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span>{s.preacher}</span>
          <span className="flex items-center gap-2">
            <CalendarDays size={15} />
            {formatDate(s.sermonDate)}
          </span>
          <span className="flex items-center gap-2">
            <BookOpen size={15} />
            {s.passage}
          </span>
        </p>
      </header>
      <BookmarkToggle sermonId={s.id} />
      <Link
        className="text-link inline-block text-sm mb-6"
        to={`/personal/journal/new?sermonId=${s.id}`}
      >
        Write a private reflection
      </Link>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0">
          <Media key={s.id} sermon={s} />
          <section className="panel p-6 sm:p-8">
            <p className="eyebrow mb-4">THE MESSAGE</p>
            {s.summary && (
              <p className="font-serif text-2xl leading-relaxed mb-6 text-accent">
                {s.summary}
              </p>
            )}
            {s.content ? (
              <div className="reading-content">{s.content}</div>
            ) : (
              <p className="text-muted text-sm">
                A full written message hasn’t been added yet.
              </p>
            )}
          </section>
        </div>
        <aside>
          <section className="growth-callout">
            <Sprout size={27} strokeWidth={1.4} />
            <p className="eyebrow mt-5">TAKE IT INTO YOUR WEEK</p>
            <h2 className="font-serif text-3xl mt-3">
              From hearing
              <br />
              to growing.
            </h2>
            <p className="text-sm text-muted leading-relaxed mt-4 mb-6">
              Slow down with a daily lesson. Reflect on the message and put a
              little truth into practice.
            </p>
            {plans.isPending ? (
              <Loading label="Loading study plans…" />
            ) : plans.isError ? (
              <ErrorState
                error={plans.error}
                retry={() => void plans.refetch()}
              />
            ) : plans.data.data.length ? (
              <div className="space-y-3">
                {plans.data.data.map((plan) => (
                  <Link
                    className="plan-link"
                    key={plan.id}
                    to={`/growth/${plan.id}`}
                  >
                    <span>{plan.title}</span>
                    <ArrowRight size={17} className="shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                No study plan has been attached to this message yet.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
