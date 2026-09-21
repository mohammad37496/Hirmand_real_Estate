import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

type MusicTrack = {
  id?: string;
  title: string;
  artist?: string;
  src: string;
  stream?: string;
  cover?: string;
};

type MusicManifest = {
  autoplay?: boolean;
  tracks: MusicTrack[];
};

const STORAGE_KEY = "hirmand-music-state";

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "۰:۰۰";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isAutoplayBlocked(error: unknown) {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resumeAfterLoadRef = useRef(false);
  const playRequestedRef = useRef(false);
  const sourceCandidatesRef = useRef<string[]>([]);
  const sourceIndexRef = useRef(0);

  const [manifest, setManifest] = useState<MusicManifest>({ tracks: [] });
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.72);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const tracks = manifest.tracks;
  const currentTrack = tracks[index] ?? null;

  useEffect(() => {
    if (tracks.length > 0 && index >= tracks.length) setIndex(0);
  }, [index, tracks.length]);

  const progress = useMemo(
    () => (duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0),
    [currentTime, duration],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/music", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("music api not found");
        return (await response.json()) as MusicManifest;
      })
      .catch(async () => {
        const response = await fetch("/music/playlist.json", { cache: "no-store" });
        if (!response.ok) throw new Error("music manifest not found");
        return (await response.json()) as MusicManifest;
      })
      .then((next) => {
        if (cancelled) return;
        const safeTracks = Array.isArray(next.tracks)
          ? next.tracks.filter((track) => track && typeof track.src === "string" && track.src.trim())
          : [];
        setManifest({ autoplay: false, tracks: safeTracks });
      })
      .catch(() => {
        if (!cancelled) setManifest({ autoplay: true, tracks: [] });
      });

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          index: number;
          volume: number;
          muted: boolean;
          shuffle: boolean;
          repeat: boolean;
          expanded: boolean;
          hidden: boolean;
        }>;
        if (Number.isInteger(saved.index)) setIndex(Math.max(0, saved.index ?? 0));
        if (typeof saved.volume === "number") setVolume(Math.min(1, Math.max(0, saved.volume)));
        if (typeof saved.muted === "boolean") setIsMuted(saved.muted);
        if (typeof saved.shuffle === "boolean") setShuffle(saved.shuffle);
        if (typeof saved.repeat === "boolean") setRepeat(saved.repeat);
        if (typeof saved.expanded === "boolean") setIsExpanded(saved.expanded);
        if (typeof saved.hidden === "boolean") setIsHidden(saved.hidden);
      }
    } catch {
      // Ignore malformed local state.
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const candidates = Array.from(
      new Set(
        [
          // Prefer the same-origin stream endpoint. It handles legacy Blob URLs
          // and keeps the browser-facing source stable across storage changes.
          currentTrack.stream,
          currentTrack.id
            ? `/api/music/file/${encodeURIComponent(currentTrack.id)}`
            : "",
          currentTrack.src,
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    sourceCandidatesRef.current = candidates;
    sourceIndexRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setLoadError(false);
    setAutoplayBlocked(false);

    if (!candidates[0]) {
      setLoadError(true);
      return;
    }

    audio.src = candidates[0];
    audio.load();

    if (!resumeAfterLoadRef.current) return;

    const attemptPlay = () => {
      audio.play()
        .then(() => {
          playRequestedRef.current = false;
          setIsPlaying(true);
        })
        .catch((error) => {
          if (switchToFallbackSource()) {
            void audio.play().then(
              () => {
                playRequestedRef.current = false;
                setIsPlaying(true);
              },
              (fallbackError) => {
                playRequestedRef.current = false;
                setIsPlaying(false);
                if (isAutoplayBlocked(fallbackError)) setAutoplayBlocked(true);
                else setLoadError(true);
              },
            );
            return;
          }

          playRequestedRef.current = false;
          setIsPlaying(false);
          if (isAutoplayBlocked(error)) setAutoplayBlocked(true);
          else setLoadError(true);
        });
    };

    if (audio.readyState >= 2) attemptPlay();
    else {
      audio.addEventListener("canplay", attemptPlay, { once: true });
      return () => audio.removeEventListener("canplay", attemptPlay);
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
    audio.muted = isMuted;
  }, [isMuted, volume]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          index,
          volume,
          muted: isMuted,
          shuffle,
          repeat,
          expanded: isExpanded,
          hidden: isHidden,
        }),
      );
    } catch {
      // Storage can be unavailable in private browsing contexts.
    }
  }, [index, isExpanded, isHidden, isMuted, repeat, shuffle, volume]);

  function switchToFallbackSource() {
    const audio = audioRef.current;
    const candidates = sourceCandidatesRef.current;
    const nextIndex = sourceIndexRef.current + 1;

    if (!audio || nextIndex >= candidates.length) return false;

    sourceIndexRef.current = nextIndex;
    setLoadError(false);
    setAutoplayBlocked(false);
    audio.src = candidates[nextIndex]!;
    audio.load();
    return true;
  }

  async function playOrPause() {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (!audio.paused) {
      playRequestedRef.current = false;
      audio.pause();
      setIsPlaying(false);
      return;
    }

    playRequestedRef.current = true;

    try {
      await audio.play();
      playRequestedRef.current = false;
      setIsPlaying(true);
      setAutoplayBlocked(false);
      setLoadError(false);
    } catch (error) {
      if (switchToFallbackSource()) {
        try {
          await audio.play();
          playRequestedRef.current = false;
          setIsPlaying(true);
          setAutoplayBlocked(false);
          setLoadError(false);
          return;
        } catch (fallbackError) {
          playRequestedRef.current = false;
          setIsPlaying(false);
          if (isAutoplayBlocked(fallbackError)) setAutoplayBlocked(true);
          else setLoadError(true);
          return;
        }
      }

      playRequestedRef.current = false;
      setIsPlaying(false);
      if (isAutoplayBlocked(error)) setAutoplayBlocked(true);
      else setLoadError(true);
    }
  }

  function selectTrack(nextIndex: number, shouldPlay = true) {
    if (!tracks.length) return;
    const safeIndex = Math.max(0, Math.min(tracks.length - 1, nextIndex));
    setIsListOpen(false);

    if (safeIndex === index && shouldPlay) {
      void playOrPause();
      return;
    }

    resumeAfterLoadRef.current = shouldPlay;
    playRequestedRef.current = shouldPlay;
    setIndex(safeIndex);
  }

  function nextTrack() {
    if (!tracks.length) return;
    const nextIndex = shuffle
      ? Math.floor(Math.random() * tracks.length)
      : (index + 1) % tracks.length;
    selectTrack(nextIndex, true);
  }

  function previousTrack() {
    if (!tracks.length) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }
    selectTrack((index - 1 + tracks.length) % tracks.length, true);
  }

  function handleEnded() {
    if (repeat && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => undefined);
      return;
    }
    nextTrack();
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(duration)) return;
    audio.currentTime = Math.max(0, Math.min(duration, value));
    setCurrentTime(audio.currentTime);
  }

  function changeVolume(value: number) {
    const safe = Math.max(0, Math.min(1, value));
    setVolume(safe);
    if (safe > 0 && isMuted) setIsMuted(false);
  }

  if (!tracks.length) {
    return (
      <div className="music-player music-player-empty" aria-label="پخش‌کننده موسیقی">
        <Music2 size={17} />
        <span>هنوز موسیقی‌ای اضافه نشده</span>
      </div>
    );
  }

  return (
    <>
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
          setLoadError(false);
        }}
        onCanPlay={() => setLoadError(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onError={() => {
          if (playRequestedRef.current && switchToFallbackSource()) {
            const fallback = audioRef.current;
            if (fallback) {
              void fallback.play().catch((error) => {
                playRequestedRef.current = false;
                setIsPlaying(false);
                if (isAutoplayBlocked(error)) setAutoplayBlocked(true);
                else setLoadError(true);
              });
            }
            return;
          }
          setIsPlaying(false);
          setLoadError(true);
        }}
      />

      <button
        type="button"
        className={isHidden ? "music-player-launcher is-visible" : "music-player-launcher"}
        onClick={() => setIsHidden(false)}
        aria-label="نمایش پخش‌کننده موسیقی"
        title="نمایش پخش‌کننده"
      >
        {isPlaying ? <Pause size={19} /> : <Music2 size={19} />}
        <span>{currentTrack.title}</span>
      </button>

      <section className={`music-player ${isExpanded ? "is-expanded" : ""} ${isHidden ? "is-hidden" : ""}`} aria-label="پخش‌کننده موسیقی هیرمند">
        <div className="music-player-main">
          <button
            type="button"
            className="music-cover"
            onClick={() => setIsExpanded((value) => !value)}
            aria-label={isExpanded ? "بستن کنترل‌های موسیقی" : "باز کردن کنترل‌های موسیقی"}
            title={isExpanded ? "بستن" : "باز کردن"}
          >
            {currentTrack.cover ? (
              <img src={currentTrack.cover} alt="" />
            ) : (
              <span aria-hidden="true"><Music2 size={19} /></span>
            )}
          </button>

          <div className="music-meta">
            <strong>{currentTrack.title}</strong>
            <span>{currentTrack.artist || "موسیقی هیرمند"}</span>
            {autoplayBlocked ? (
              <small>برای شروع موسیقی روی پخش بزنید</small>
            ) : loadError ? (
              <small>فایل موسیقی قابل پخش نیست؛ لینک یا فرمت فایل را بررسی کنید.</small>
            ) : null}
          </div>

          <div className="music-transport" aria-label="کنترل پخش">
            <button type="button" onClick={previousTrack} aria-label="آهنگ قبلی" title="قبلی">
              <SkipBack size={17} />
            </button>
            <button type="button" className="music-play" onClick={playOrPause} aria-label={isPlaying ? "توقف" : "پخش"} title={isPlaying ? "توقف" : "پخش"}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
            </button>
            <button type="button" onClick={nextTrack} aria-label="آهنگ بعدی" title="بعدی">
              <SkipForward size={17} />
            </button>
          </div>

          <div className="music-compact-actions" aria-label="اقدامات پخش‌کننده">
            <button type="button" onClick={() => setIsListOpen((value) => !value)} aria-expanded={isListOpen} aria-label="فهرست موسیقی" title="فهرست">
              <ListMusic size={17} />
            </button>
            <button type="button" onClick={() => setIsExpanded((value) => !value)} aria-expanded={isExpanded} aria-label="تنظیمات پخش" title="تنظیمات">
              {isExpanded ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
            </button>
            <button type="button" onClick={() => setIsHidden(true)} aria-label="مخفی کردن پخش‌کننده" title="مخفی کردن">
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="music-progress-row">
          <span>{formatTime(currentTime)}</span>
          <input
            className="music-progress"
            type="range"
            min="0"
            max={Math.max(duration, 0)}
            step="0.1"
            value={Math.min(currentTime, Math.max(duration, 0))}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="موقعیت آهنگ"
            style={{ "--music-progress": `${progress}%` } as CSSProperties}
          />
          <span>{formatTime(duration)}</span>
        </div>

        {loadError ? (
          <div className="music-player-error" role="alert">
            فایل موسیقی از سرور قابل دریافت نیست؛ دوباره روی «پخش» بزنید.
          </div>
        ) : null}

        {isExpanded ? (
          <div className="music-player-panel">
            <div className="music-secondary-controls">
              <button type="button" className={shuffle ? "is-active" : ""} onClick={() => setShuffle((value) => !value)} aria-pressed={shuffle} title="پخش تصادفی">
                <Shuffle size={16} />
                <span>تصادفی</span>
              </button>
              <button type="button" className={repeat ? "is-active" : ""} onClick={() => setRepeat((value) => !value)} aria-pressed={repeat} title="تکرار">
                <Repeat2 size={16} />
                <span>تکرار</span>
              </button>
              <label className="music-volume" title="صدا">
                <button type="button" onClick={() => setIsMuted((value) => !value)} aria-label={isMuted ? "روشن کردن صدا" : "بی‌صدا کردن"}>
                  {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(event) => changeVolume(Number(event.target.value))}
                  aria-label="بلندی صدا"
                />
              </label>
            </div>
          </div>
        ) : null}

        {isListOpen ? (
          <div className="music-playlist" role="listbox" aria-label="فهرست آهنگ‌ها">
            <div className="music-playlist-head">
              <strong>موسیقی‌های هیرمند</strong>
              <span>{tracks.length} آهنگ</span>
            </div>
            <div className="music-playlist-list">
              {tracks.map((track, trackIndex) => (
                <button
                  type="button"
                  key={`${track.src}-${trackIndex}`}
                  className={trackIndex === index ? "music-track is-active" : "music-track"}
                  onClick={() => selectTrack(trackIndex, true)}
                  role="option"
                  aria-selected={trackIndex === index}
                >
                  <span className="music-track-number">{String(trackIndex + 1).padStart(2, "0")}</span>
                  <span className="music-track-copy">
                    <strong>{track.title}</strong>
                    <small>{track.artist || "هیرمند"}</small>
                  </span>
                  {trackIndex === index && isPlaying ? <span className="music-bars" aria-hidden="true"><i /><i /><i /></span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
