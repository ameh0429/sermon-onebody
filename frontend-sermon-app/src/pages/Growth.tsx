import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  Search,
  Sprout,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, send } from "../api";
import {
  Back,
  Empty,
  ErrorState,
  Loading,
  PageHeading,
  Pagination,
} from "../ui";
import type { Lesson, Plan, Progress } from "../types";
export function GrowthLibrary() {
  const [params, setParams] = useSearchParams();
  const queryString = new URLSearchParams(params);
  queryString.set("limit", "9");
  const plans = useQuery({
    queryKey: ["plans", queryString.toString()],
    queryFn: () => api<Plan[]>(`/study-plans?${queryString}`),
  });
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    setParams(q ? { q } : {});
  }
  return (
    <>
      <PageHeading eyebrow="WEEKLY GROWTH" title="Small steps. Deeper roots.">
        Turn a message into a daily practice. A little reading, a little
        reflection, and room to grow.
      </PageHeading>
      <div className="growth-intro">
        <div className="rounded-full bg-white/70 p-4">
          <Sprout className="text-forest" size={30} strokeWidth={1.4} />
        </div>
        <div>
          <h2 className="font-serif text-2xl">
            No rush. Just a faithful rhythm.
          </h2>
          <p className="text-sm text-muted mt-2">
            Choose a plan, work through the days, and pick up wherever you left
            off.
          </p>
        </div>
      </div>
      <form
        onSubmit={search}
        className="search-input my-7"
        key={params.get("q") ?? ""}
      >
        <Search size={18} />
        <label className="sr-only" htmlFor="plan-search">
          Search study plans
        </label>
        <input
          id="plan-search"
          name="q"
          maxLength={200}
          placeholder="Find a study plan…"
          defaultValue={params.get("q") ?? ""}
        />
        <button type="submit" className="text-link">
          Search
        </button>
        {params.has("q") && (
          <button
            type="button"
            className="text-muted text-sm"
            onClick={() => setParams({})}
          >
            Clear
          </button>
        )}
      </form>
      {plans.isPending ? (
        <Loading label="Gathering your next steps…" />
      ) : plans.isError ? (
        <ErrorState error={plans.error} retry={() => void plans.refetch()} />
      ) : plans.data.data.length === 0 ? (
        <Empty title="Room for something new.">
          <p>
            {params.has("q")
              ? "No plans match your search. Try another title."
              : "Study plans will appear here when they’re attached to published sermons."}
          </p>
          <Link to="/sermons" className="text-link mt-4 inline-block">
            Explore the sermon library
          </Link>
        </Empty>
      ) : (
        <>
          <div className="sermon-grid">
            {plans.data.data.map((plan, index) => (
              <Link
                key={plan.id}
                to={`/growth/${plan.id}`}
                className="panel plan-card group"
              >
                <div className={`plan-card-icon tone-${index % 3}`}>
                  <Sprout size={29} strokeWidth={1.5} />
                </div>
                <p className="eyebrow mt-6">A WEEK IN THE WORD</p>
                <h2 className="font-serif text-2xl mt-3 group-hover:text-forest">
                  {plan.title}
                </h2>
                {plan.description && (
                  <p className="text-sm text-muted leading-relaxed mt-3 line-clamp-3">
                    {plan.description}
                  </p>
                )}
                {plan.sermon && (
                  <div className="mt-5 pt-4 border-t border-line flex gap-2 text-xs text-muted">
                    <BookOpen size={15} className="shrink-0" />
                    <span>From “{plan.sermon.title}”</span>
                  </div>
                )}
                <span className="flex items-center justify-between text-sm text-forest font-semibold mt-auto pt-6">
                  Open study plan
                  <ArrowRight size={17} />
                </span>
              </Link>
            ))}
          </div>
          <Pagination
            page={plans.data.meta?.page ?? 1}
            totalPages={plans.data.meta?.totalPages ?? 1}
            change={(page) => {
              const next = new URLSearchParams(params);
              next.set("page", String(page));
              setParams(next);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}
    </>
  );
}
export function StudyPlanPage() {
  const { planId } = useParams();
  const [params, setParams] = useSearchParams();
  const plan = useQuery({
    queryKey: ["plan", planId],
    queryFn: () => api<Plan>(`/study-plans/${planId}`),
  });
  const progress = useQuery({
    queryKey: ["progress", planId],
    queryFn: () => api<Progress>(`/study-plans/${planId}/progress`),
  });
  if (plan.isPending) return <Loading label="Opening your study plan…" />;
  if (plan.isError)
    return (
      <>
        <Back to="/growth">Weekly growth</Back>
        <ErrorState error={plan.error} retry={() => void plan.refetch()} />
      </>
    );
  const p = plan.data.data,
    lessons = p.dailyLessons ?? [];
  const selected =
    lessons.find((l) => l.day === Number(params.get("day"))) ?? lessons[0];
  const completedIds = new Set(
    progress.data?.data.dailyLessons
      .filter((l) => l.completed)
      .map((l) => l.dailyLessonId),
  );
  const stats = progress.data?.data;
  return (
    <>
      <Back to="/growth">Weekly growth</Back>
      <PageHeading eyebrow="YOUR WEEK IN THE WORD" title={p.title}>
        {p.description}
      </PageHeading>
      <div className="plan-progress">
        <div className="flex items-center gap-3">
          <span className="progress-icon">
            <Sprout size={22} />
          </span>
          <div>
            <p className="font-semibold text-sm">
              {stats &&
              stats.totalLessons > 0 &&
              stats.completedLessons === stats.totalLessons
                ? "Every small step adds up. Well done!"
                : "A little growth, every day."}
            </p>
            <p className="text-xs text-muted mt-1">
              {stats
                ? `${stats.completedLessons} of ${stats.totalLessons} lessons completed`
                : "Loading your progress…"}
            </p>
          </div>
        </div>
        {stats && (
          <div className="progress-meter">
            <span className="text-xs text-forest font-semibold">
              {stats.completionPercentage}%
            </span>
            <progress
              max={100}
              value={stats.completionPercentage}
              aria-label="Study plan completion"
            />
          </div>
        )}
      </div>
      {progress.isError && (
        <div className="my-5">
          <ErrorState
            error={progress.error}
            retry={() => void progress.refetch()}
          />
        </div>
      )}
      {!selected ? (
        <Empty title="Your next chapter is on its way.">
          <p>This plan doesn’t have any lessons yet.</p>
        </Empty>
      ) : (
        <div className="lesson-layout">
          <nav aria-label="Daily lessons" className="lesson-nav">
            <p className="eyebrow mb-4">THE DAILY RHYTHM</p>
            <ol className="lesson-list">
              {lessons.map((l) => (
                <li key={l.id}>
                  <button
                    className={`lesson-step ${selected.id === l.id ? "selected" : ""} ${completedIds.has(l.id) ? "completed" : ""}`}
                    onClick={() => setParams({ day: String(l.day) })}
                    aria-current={selected.id === l.id ? "step" : undefined}
                  >
                    <span className="step-circle">
                      {completedIds.has(l.id) ? (
                        <Check size={16} />
                      ) : (
                        String(l.day).padStart(2, "0")
                      )}
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-[10px] uppercase tracking-widest text-muted">
                        Day {l.day}
                        {completedIds.has(l.id) ? " · Complete" : ""}
                      </span>
                      <span className="block text-sm mt-1 leading-snug">
                        {l.title}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 ml-auto" />
                  </button>
                </li>
              ))}
            </ol>
            {p.sermonId && (
              <Link
                className="text-link text-xs flex items-center gap-2 mt-6"
                to={`/sermons/${p.sermonId}`}
              >
                <BookOpen size={15} />
                Return to the sermon
              </Link>
            )}
          </nav>
          <DailyLesson
            key={`${planId}-${selected.day}`}
            planId={planId!}
            selected={selected}
            completed={completedIds.has(selected.id)}
            progressReady={!!stats}
            nextDay={
              lessons[lessons.findIndex((l) => l.id === selected.id) + 1]?.day
            }
            goNext={(day) => setParams({ day: String(day) })}
          />
        </div>
      )}
    </>
  );
}
function DailyLesson({
  planId,
  selected,
  completed,
  progressReady,
  nextDay,
  goNext,
}: {
  planId: string;
  selected: Lesson;
  completed: boolean;
  progressReady: boolean;
  nextDay?: number;
  goNext: (day: number) => void;
}) {
  const client = useQueryClient();
  const [saved, setSaved] = useState(false);
  const lesson = useQuery({
    queryKey: ["lesson", planId, selected.day],
    queryFn: () =>
      api<Lesson>(`/study-plans/${planId}/daily-lessons/${selected.day}`),
  });
  const update = useMutation({
    mutationFn: (done: boolean) =>
      api(
        `/daily-lessons/${selected.id}/progress`,
        send("PUT", { completed: done }),
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["progress", planId] });
      setSaved(true);
    },
  });
  if (lesson.isPending) return <Loading label="Opening today’s lesson…" />;
  if (lesson.isError)
    return (
      <ErrorState error={lesson.error} retry={() => void lesson.refetch()} />
    );
  const l = lesson.data.data;
  return (
    <article className="panel lesson-content">
      <div className="flex justify-between items-center gap-3">
        <span className="badge">DAY {l.day.toString().padStart(2, "0")}</span>
        {completed && (
          <span className="flex items-center gap-1.5 text-xs text-forest">
            <CheckCheck size={17} />
            Completed
          </span>
        )}
      </div>
      <h2 className="font-serif text-3xl sm:text-4xl leading-tight mt-6">
        {l.title}
      </h2>
      {l.passage && (
        <div className="scripture-reference">
          <BookOpen size={19} strokeWidth={1.5} />
          <div>
            <p className="eyebrow text-[9px]! mb-1">TODAY’S SCRIPTURE</p>
            <p className="font-serif text-xl">{l.passage}</p>
          </div>
        </div>
      )}
      <div className="reading-content mt-7">{l.content}</div>
      <div className="reflection-note">
        <Circle size={15} className="shrink-0 text-sage mt-0.5" />
        <p>
          Pause for a moment. What will you carry from this lesson into today?
        </p>
      </div>
      <div className="lesson-actions">
        <button
          className={completed ? "btn-secondary" : "btn-primary"}
          disabled={!progressReady || update.isPending}
          onClick={() => {
            setSaved(false);
            update.mutate(!completed);
          }}
        >
          {update.isPending ? (
            "Saving…"
          ) : completed ? (
            <>
              <Check size={17} />
              Mark incomplete
            </>
          ) : (
            <>
              <Check size={17} />
              Mark lesson complete
            </>
          )}
        </button>
        {nextDay != null && (
          <button
            onClick={() => goNext(nextDay)}
            className="text-link inline-flex items-center gap-2 text-sm"
          >
            Next lesson
            <ArrowRight size={16} />
          </button>
        )}
      </div>
      {saved && (
        <p className="mt-4 text-sm text-forest" role="status">
          Your progress has been saved.
        </p>
      )}
      {update.isError && (
        <div className="mt-4">
          <ErrorState error={update.error} />
        </div>
      )}
    </article>
  );
}
