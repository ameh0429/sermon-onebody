import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Flag, MessageCircle, Plus, Users } from "lucide-react";
import { useAuth } from "../auth";
import { api, send } from "../api";
import type { Group, GroupMember, Post } from "../types";
import {
  Back,
  Empty,
  ErrorState,
  formatDate,
  Loading,
  PageHeading,
  Pagination,
} from "../ui";
import {
  ActionError,
  ConfirmButton,
  ListPages,
  ListSearch,
  SermonPicker,
  useAction,
} from "../features";
export function GroupsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = new URLSearchParams(params);
  q.set("limit", "12");
  const query = useQuery({
    queryKey: ["groups", q.toString()],
    queryFn: () => api<Group[]>(`/groups?${q}`),
  });
  return (
    <>
      <PageHeading eyebrow="FELLOWSHIP" title="We grow better together.">
        Find your people. Share a question, a story, or a little encouragement.
      </PageHeading>
      <div className="flex gap-3 flex-wrap mb-5">
        <button
          className="btn-secondary"
          aria-pressed={params.get("mine") === "true"}
          onClick={() => {
            const next = new URLSearchParams(params);
            params.get("mine") === "true"
              ? next.delete("mine")
              : next.set("mine", "true");
            next.delete("page");
            setParams(next);
          }}
        >
          {params.get("mine") === "true" ? "Show all groups" : "My groups"}
        </button>
        {user?.role !== "member" && (
          <Link className="btn-primary" to="/groups/new">
            <Plus size={16} />
            Create group
          </Link>
        )}
      </div>
      <ListSearch placeholder="Search fellowship groups…" />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.data.length ? (
        <Empty title="There’s room for you.">
          <p>No groups found. Try another search or explore all groups.</p>
        </Empty>
      ) : (
        <>
          <div className="sermon-grid">
            {query.data.data.map((g) => (
              <Link
                to={`/groups/${g.id}`}
                className="panel p-6 hover:border-sage"
                key={g.id}
              >
                <Users size={28} className="text-sage" />
                <h2 className="font-serif text-2xl mt-5">{g.name}</h2>
                <p className="text-sm text-muted line-clamp-3 mt-3">
                  {g.description ?? "A space to connect and grow."}
                </p>
                <p className="mt-5 text-xs text-accent">
                  Led by {g.leader?.name ?? "your community"}
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
export function GroupEditor() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api<Group>(`/groups/${groupId}`),
    enabled: !!groupId,
  });
  if (groupId && query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} />;
  const group = query.data?.data;
  if (
    group
      ? user?.role !== "admin" && user?.id !== group.leaderId
      : user?.role === "member"
  )
    return (
      <ErrorState
        error={new Error("Only a group leader or admin can manage this group.")}
      />
    );
  return <GroupForm key={groupId ?? "new"} group={group} />;
}
function GroupForm({ group }: { group?: Group }) {
  const navigate = useNavigate();
  const save = useAction(
    (body: unknown) =>
      api<Group>(
        group ? `/groups/${group.id}` : "/groups",
        send(group ? "PATCH" : "POST", body),
      ),
    [["groups"], ["group"]],
    (value) => navigate(`/groups/${value.data.id}`),
  );
  const remove = useAction(
    () => api<void>(`/groups/${group!.id}`, { method: "DELETE" }),
    [["groups"]],
    () => navigate("/groups"),
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({ name: f.get("name"), description: f.get("description") });
  }
  return (
    <>
      <Back to={group ? `/groups/${group.id}` : "/groups"}>Fellowship</Back>
      <PageHeading
        eyebrow="MAKE ROOM FOR COMMUNITY"
        title={group ? "Care for your group." : "Start a conversation."}
      />
      <form className="panel p-6 space-y-5" onSubmit={submit}>
        <label className="field">
          Group name
          <input
            name="name"
            required
            minLength={3}
            maxLength={120}
            defaultValue={group?.name}
          />
        </label>
        <label className="field">
          Description
          <textarea
            aria-label="Description"
            name="description"
            maxLength={2000}
            rows={5}
            defaultValue={group?.description ?? ""}
          />
        </label>
        <ActionError error={save.error ?? remove.error} />
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-primary"
            disabled={save.isPending || remove.isPending}
          >
            Save group
          </button>
          {group && (
            <ConfirmButton
              message="Delete this group, its membership and all discussions?"
              onConfirm={() => remove.mutate()}
              disabled={save.isPending || remove.isPending}
            >
              Delete group
            </ConfirmButton>
          )}
        </div>
      </form>
    </>
  );
}
export function GroupDetail() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<"discussion" | "members" | "flagged">(
    "discussion",
  );
  const query = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api<Group>(`/groups/${groupId}`),
  });
  const membership = useAction(
    (leave: boolean) =>
      api(`/groups/${groupId}/${leave ? "leave" : "join"}`, {
        method: leave ? "DELETE" : "POST",
      }),
    [
      ["group", groupId],
      ["groups"],
      ["threads", groupId],
      ["members", groupId],
    ],
  );
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <>
        <Back to="/groups">Fellowship</Back>
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      </>
    );
  const group = query.data.data,
    moderate = user?.role === "admin" || user?.id === group.leaderId,
    access =
      group.isMember || user?.role === "admin" || user?.id === group.leaderId;
  return (
    <>
      <Back to="/groups">Fellowship</Back>
      <PageHeading eyebrow="A PLACE TO BELONG" title={group.name}>
        {group.description}
      </PageHeading>
      <div className="flex gap-3 flex-wrap items-center mb-6">
        <span className="badge">
          <Users size={14} />
          {group.memberCount} members · {group.leader?.name}
        </span>
        {!group.isMember ? (
          <button
            className="btn-primary"
            disabled={membership.isPending}
            onClick={() => membership.mutate(false)}
          >
            Join group
          </button>
        ) : user?.id !== group.leaderId ? (
          <ConfirmButton
            message="Leave this group? You’ll lose access to its discussions until you rejoin."
            onConfirm={() => membership.mutate(true)}
            disabled={membership.isPending}
          >
            Leave group
          </ConfirmButton>
        ) : (
          <span className="text-xs text-muted">You lead this group.</span>
        )}
        {moderate && (
          <Link className="btn-secondary" to={`/groups/${groupId}/edit`}>
            Manage group
          </Link>
        )}
      </div>
      <ActionError error={membership.error} />
      {access ? (
        <>
          <div className="feature-tabs">
            <button
              aria-pressed={tab === "discussion"}
              onClick={() => setTab("discussion")}
            >
              Discussions
            </button>
            <button
              aria-pressed={tab === "members"}
              onClick={() => setTab("members")}
            >
              Members
            </button>
            {moderate && (
              <button
                aria-pressed={tab === "flagged"}
                onClick={() => setTab("flagged")}
              >
                Flagged posts
              </button>
            )}
          </div>
          {tab === "members" ? (
            <Members groupId={groupId!} />
          ) : (
            <Threads
              key={tab}
              group={group}
              flagged={tab === "flagged"}
              moderate={moderate}
            />
          )}
        </>
      ) : (
        <Empty title="A conversation is waiting.">
          <p>
            Join this group to read discussions, reply, and meet the members.
          </p>
        </Empty>
      )}
    </>
  );
}
function Members({ groupId }: { groupId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["members", groupId, page],
    queryFn: () =>
      api<GroupMember[]>(`/groups/${groupId}/members?page=${page}&limit=20`),
  });
  return query.isPending ? (
    <Loading />
  ) : query.isError ? (
    <ErrorState error={query.error} retry={() => void query.refetch()} />
  ) : (
    <>
      <ul className="panel divide-y divide-line">
        {query.data.data.map((m) => (
          <li key={m.userId} className="p-5 flex justify-between gap-4">
            <span>{m.user.name}</span>
            <span className="badge">{m.role}</span>
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        totalPages={query.data.meta?.totalPages ?? 1}
        change={setPage}
      />
    </>
  );
}
function Threads({
  group,
  flagged,
  moderate,
}: {
  group: Group;
  flagged: boolean;
  moderate: boolean;
}) {
  const [page, setPage] = useState(1);
  const [sermonId, setSermonId] = useState("");
  const query = useQuery({
    queryKey: ["threads", group.id, flagged, page, sermonId],
    queryFn: () =>
      api<Post[]>(
        `/groups/${group.id}/posts${flagged ? "/flagged" : ""}?page=${page}&limit=10${sermonId ? `&sermonId=${sermonId}` : ""}`,
      ),
  });
  return (
    <>
      {!flagged && (
        <>
          <details className="panel p-4 mb-5">
            <summary className="text-sm text-accent cursor-pointer">
              Filter by sermon
            </summary>
            <SermonPicker
              value={sermonId}
              onChange={(id) => {
                setSermonId(id);
                setPage(1);
              }}
            />
          </details>
          <PostComposer groupId={group.id} />
        </>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.data.length ? (
        <Empty title={flagged ? "All quiet here." : "Be the first to share."}>
          <p>
            {flagged
              ? "No flagged posts to review."
              : "Ask a question or share something that encouraged you."}
          </p>
        </Empty>
      ) : (
        <>
          <div className="space-y-5">
            {query.data.data.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                groupId={group.id}
                moderate={moderate}
              />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={query.data.meta?.totalPages ?? 1}
            change={setPage}
          />
        </>
      )}
    </>
  );
}
function PostComposer({
  groupId,
  parentId,
}: {
  groupId: string;
  parentId?: string;
}) {
  const [content, setContent] = useState(""),
    [sermonId, setSermonId] = useState("");
  const create = useAction(
    (body: unknown) =>
      api<Post>(`/groups/${groupId}/posts`, send("POST", body)),
    [["threads", groupId]],
    () => setContent(""),
  );
  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate({
      content,
      ...(parentId ? { parentPostId: parentId } : sermonId ? { sermonId } : {}),
    });
  }
  return (
    <form className="panel p-5 mb-6 space-y-4" onSubmit={submit}>
      <label className="field">
        {parentId ? "Your reply" : "Share with your group"}
        <textarea
          required
          maxLength={5000}
          rows={parentId ? 2 : 3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="A question, a reflection, a little encouragement…"
        />
      </label>
      {!parentId && (
        <details>
          <summary className="text-xs text-accent cursor-pointer">
            Connect to a sermon (optional)
          </summary>
          <SermonPicker value={sermonId} onChange={setSermonId} />
        </details>
      )}
      <ActionError error={create.error} />
      <button
        className="btn-primary"
        disabled={create.isPending || !content.trim()}
      >
        <MessageCircle size={16} />
        {create.isPending
          ? "Posting…"
          : parentId
            ? "Post reply"
            : "Post discussion"}
      </button>
    </form>
  );
}
function PostCard({
  post,
  groupId,
  moderate,
  reply = false,
}: {
  post: Post;
  groupId: string;
  moderate: boolean;
  reply?: boolean;
}) {
  const { user } = useAuth();
  const [respond, setRespond] = useState(false),
    [flagging, setFlagging] = useState(false),
    [reason, setReason] = useState("");
  const remove = useAction(
    () => api<void>(`/posts/${post.id}`, { method: "DELETE" }),
    [["threads", groupId]],
  );
  const flag = useAction(
    () => api(`/posts/${post.id}/flag`, send("POST", { reason })),
    [["threads", groupId]],
    () => setFlagging(false),
  );
  return (
    <article className={reply ? "reply-card" : "panel p-5 sm:p-6"}>
      <header className="flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span className="font-semibold text-ink">
          {post.author?.name ?? "Community member"}
        </span>
        <span>{formatDate(post.createdAt)}</span>
      </header>
      <p className="whitespace-pre-wrap break-words leading-relaxed text-sm my-4">
        {post.content}
      </p>
      {post.sermonId && !reply && (
        <Link className="text-link text-xs" to={`/sermons/${post.sermonId}`}>
          Related sermon
        </Link>
      )}
      {post.isFlagged && (
        <p className="text-xs text-warning-ink mt-3">
          <Flag size={12} className="inline mr-1" />
          Flagged for review
          {moderate && post.flagReason ? `: ${post.flagReason}` : ""}
        </p>
      )}
      <div className="flex gap-4 flex-wrap mt-4 text-xs">
        {!reply && (
          <button className="text-link" onClick={() => setRespond(!respond)}>
            {respond ? "Close reply" : "Reply"}
          </button>
        )}
        {post.authorId !== user?.id && (
          <button className="text-link" onClick={() => setFlagging(!flagging)}>
            Report post
          </button>
        )}
        {(post.authorId === user?.id || moderate) && (
          <ConfirmButton
            className="text-link"
            message={
              reply ? "Delete this reply?" : "Delete this post and all replies?"
            }
            onConfirm={() => remove.mutate()}
            disabled={remove.isPending}
          >
            Delete post
          </ConfirmButton>
        )}
      </div>
      <ActionError error={remove.error ?? flag.error} />
      {flagging && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            flag.mutate();
          }}
        >
          <label className="field">
            Reason for reporting
            <input
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className="btn-secondary" disabled={flag.isPending}>
            Send report
          </button>
        </form>
      )}
      {respond && (
        <div className="mt-4">
          <PostComposer groupId={groupId} parentId={post.id} />
        </div>
      )}
      {post.replies?.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          groupId={groupId}
          moderate={moderate}
          reply
        />
      ))}
    </article>
  );
}
