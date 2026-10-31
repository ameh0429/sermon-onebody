import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Upload } from "lucide-react";
import { api, safeMediaUrl } from "./api";
import { useAuth } from "./auth";
import type { User } from "./types";
import { ErrorState } from "./ui";

export function Avatar({
  user,
  className = "",
}: {
  user: Pick<User, "name" | "avatarUrl">;
  className?: string;
}) {
  const url = safeMediaUrl(user.avatarUrl);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span
      className={`avatar overflow-hidden ${className}`}
      role="img"
      aria-label={`${user.name}'s profile picture`}
    >
      {url && failedUrl !== url ? (
        <img
          className="h-full w-full object-cover"
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        user.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
export function ProfilePhotoEditor() {
  const { user, updateAccount } = useAuth();
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null),
    [message, setMessage] = useState(""),
    [previewFailed, setPreviewFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!user) return null;
  function clear() {
    setFile(null);
    setPreviewFailed(false);
    if (input.current) input.current.value = "";
  }
  function choose(value: File | undefined) {
    setError(null);
    setMessage("");
    setPreviewFailed(false);
    if (!value) {
      clear();
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(value.type)) {
      clear();
      setError(new Error("Choose a JPEG, PNG, or WebP photo."));
      return;
    }
    if (value.size > 5 * 1024 * 1024) {
      clear();
      setError(new Error("Your photo must be 5 MiB or smaller."));
      return;
    }
    setFile(value);
  }
  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file || pending || previewFailed) return;
    setPending(true);
    setError(null);
    setMessage("");
    try {
      const body = new FormData();
      body.append("avatar", file);
      await updateAccount(() =>
        api<User>("/users/me/avatar", { method: "PUT", body }),
      );
      clear();
      setMessage("Your profile photo has been updated.");
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    if (
      pending ||
      !window.confirm(
        "Remove your profile photo? Your initial will be shown instead.",
      )
    )
      return;
    setPending(true);
    setError(null);
    setMessage("");
    try {
      await updateAccount(() =>
        api<User>("/users/me/avatar", { method: "DELETE" }),
      );
      clear();
      setMessage("Your profile photo has been removed.");
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel p-6 sm:p-8 mb-6">
      <div className="flex items-center gap-4 mb-5">
        {preview ? (
          <img
            src={preview}
            alt="New profile photo preview"
            className="h-20 w-20 rounded-full object-cover shrink-0"
            onError={() => {
              setPreviewFailed(true);
              setError(
                new Error(
                  "This photo cannot be previewed. Choose a valid image.",
                ),
              );
            }}
          />
        ) : (
          <Avatar user={user} className="h-20! w-20! text-2xl!" />
        )}
        <div>
          <h2 className="font-serif text-2xl">A familiar face.</h2>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            JPEG, PNG, or WebP · up to 5 MiB
            <br />
            Saved as a square photo. Image metadata is removed.
          </p>
        </div>
      </div>
      <form onSubmit={upload} className="space-y-4">
        <label className="field">
          Choose profile photo
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => choose(e.target.files?.[0])}
            disabled={pending}
          />
        </label>
        <p className="text-xs text-muted leading-relaxed">
          Profile photos are stored as publicly accessible images. Only you can
          replace or remove your photo.
        </p>
        {file && (
          <p className="text-sm text-muted break-all">Selected: {file.name}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-primary"
            disabled={!file || pending || previewFailed}
          >
            <Upload size={16} />
            {pending ? "Saving…" : "Upload photo"}
          </button>
          {file && (
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() => {
                clear();
                setError(null);
              }}
            >
              Cancel selection
            </button>
          )}
          {user.avatarUrl && (
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() => void remove()}
            >
              <Camera size={16} />
              Remove photo
            </button>
          )}
        </div>
        {pending && (
          <p className="text-xs text-muted" role="status">
            Saving your photo. Please keep this page open.
          </p>
        )}
        {error != null && <ErrorState error={error} />}
        {message && (
          <p className="text-sm text-accent" role="status">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
