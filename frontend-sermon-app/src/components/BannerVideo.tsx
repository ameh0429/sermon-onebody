import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const videoUrl =
  "https://res.cloudinary.com/dxpopimi3/video/upload/v1793627496/VID-20240923-WA0008_caqs4a.mp4";
export function BannerVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  if (reducedMotion || failed) return null;
  return (
    <>
      <video
        ref={video}
        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(110deg, rgb(8 11 38 / 85%), rgb(8 11 38 / 60%))",
        }}
      />
      <button
        type="button"
        aria-label={playing ? "Pause banner video" : "Play banner video"}
        className="absolute z-20 bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-black/50 text-white hover:bg-black/75"
        onClick={() => {
          if (!video.current) return;
          if (video.current.paused)
            void video.current.play().catch(() => setPlaying(false));
          else video.current.pause();
        }}
      >
        {playing ? (
          <Pause size={18} aria-hidden="true" />
        ) : (
          <Play size={18} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
