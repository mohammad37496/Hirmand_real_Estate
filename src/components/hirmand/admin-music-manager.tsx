import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Music2, Pause, Play, Trash2, Upload, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

type AdminMusicTrack = { id: string; title: string; artist: string; url: string; mimeType: string; sizeBytes: number; active: boolean; position: number; createdAt: string };

function formatSize(bytes: number) {
  return bytes > 0 ? (bytes / 1024 / 1024).toFixed(1) + " MB" : "—";
}

function isAutoplayBlocked(error: unknown) {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

export function AdminMusicManager({ adminKey }: { adminKey: string }) {
  const [tracks, setTracks] = useState<AdminMusicTrack[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/music-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "list", adminKey }),
      });
      if (!response.ok) throw new Error("بارگذاری آهنگ‌ها انجام نشد.");
      const data = (await response.json()) as { tracks?: AdminMusicTrack[] };
      setTracks(Array.isArray(data.tracks) ? data.tracks : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری آهنگ‌ها انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void load();
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [load]);

  async function uploadTrack(event: FormEvent) {
    event.preventDefault();

    if (!file) {
      toast.error("یک فایل صوتی انتخاب کنید.");
      return;
    }
    if (!title.trim()) {
      toast.error("عنوان آهنگ را وارد کنید.");
      return;
    }

    setBusy(true);
    setUploadProgress(0);

    try {
      const safeName = file.name
        .replace(/[^\\w.\\u0600-\\u06FF-]+/g, "-")
        .slice(0, 100);
      const pathname = "music/" + Date.now() + "-" + safeName;

      // Use Vercel's official browser upload client. It handles direct
      // Blob uploads, progress events and multipart/retries for large files.
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/music-upload",
        headers: { "x-hirmand-admin-key": adminKey },
        clientPayload: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          contentType: file.type || "audio/mpeg",
          sizeBytes: file.size,
        }),
        multipart: file.size >= 5 * 1024 * 1024,
        onUploadProgress: (event) => {
          setUploadProgress(Math.max(0, Math.min(100, event.percentage)));
        },
      });

      setUploadProgress(100);

      const response = await fetch("/api/music-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          adminKey,
          title: title.trim(),
          artist: artist.trim(),
          url: blob.url,
          mimeType: file.type || blob.contentType || "audio/mpeg",
          sizeBytes: file.size,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { track?: AdminMusicTrack; statusMessage?: string; message?: string }
        | null;

      if (!response.ok || !data?.track) {
        throw new Error(
          data?.statusMessage ||
            data?.message ||
            "ثبت آهنگ در کتابخانه انجام نشد.",
        );
      }

      setTracks((prev) => [...prev, data.track!]);
      setTitle("");
      setArtist("");
      setFile(null);

      const input = document.getElementById("admin-music-file") as HTMLInputElement | null;
      if (input) input.value = "";

      toast.success("آهنگ با موفقیت اضافه شد.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "آپلود آهنگ انجام نشد.",
      );
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  }

  function stopAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
    setProgress(0);
  }

  function playTrack(track: AdminMusicTrack) {
    if (playingId === track.id) {
      if (audioRef.current?.paused) {
        void audioRef.current.play().catch((error) => {
          if (isAutoplayBlocked(error)) {
            toast.error("مرورگر اجازه شروع پخش را نداد؛ دوباره روی پخش بزنید.");
          } else {
            toast.error("فایل صوتی قابل پخش نیست.");
          }
        });
      } else {
        audioRef.current?.pause();
      }
      return;
    }

    stopAudio();

    const candidates = [
      track.url,
      `/api/music/file/${encodeURIComponent(track.id)}`,
    ].filter((value, index, list) => value && list.indexOf(value) === index);

    const audio = new Audio();
    let sourceIndex = 0;
    audio.muted = muted;
    audio.preload = "metadata";

    const loadSource = (index: number) => {
      const source = candidates[index];
      if (!source) {
        toast.error("این فایل موسیقی قابل دریافت یا پخش نیست.");
        stopAudio();
        return;
      }
      sourceIndex = index;
      audio.src = source;
      audio.load();
      void audio.play().catch((error) => {
        if (sourceIndex + 1 < candidates.length) {
          loadSource(sourceIndex + 1);
          return;
        }
        if (isAutoplayBlocked(error)) {
          toast.error("مرورگر اجازه شروع پخش را نداد؛ دوباره روی پخش بزنید.");
        } else {
          toast.error("این فایل صوتی قابل پخش نیست.");
        }
        stopAudio();
      });
    };

    audio.onplay = () => setPlayingId(track.id);
    audio.onpause = () => setPlayingId((id) => (id === track.id ? null : id));
    audio.ontimeupdate = () => {
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    audio.onended = stopAudio;
    audio.onerror = () => {
      if (sourceIndex + 1 < candidates.length) {
        loadSource(sourceIndex + 1);
        return;
      }
      toast.error("این فایل موسیقی از سرور قابل دریافت نیست.");
      stopAudio();
    };

    audioRef.current = audio;
    loadSource(0);
  }

  async function action(id: string, actionName: "toggle" | "delete", active?: boolean) {
    if (actionName === "delete" && !confirm("این آهنگ از فهرست سایت حذف شود؟")) return;

    try {
      const response = await fetch("/api/music-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: actionName, adminKey, id, active }),
      });
      const data = (await response.json().catch(() => null)) as
        | { statusMessage?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.statusMessage || data?.message || "عملیات انجام نشد.");
      }

      if (actionName === "delete") {
        setTracks((prev) => prev.filter((item) => item.id !== id));
        if (playingId === id) stopAudio();
      } else {
        setTracks((prev) =>
          prev.map((item) => (item.id === id ? { ...item, active: active === true } : item)),
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "عملیات انجام نشد.");
    }
  }

  return (
    <div className="admin-music-manager">
      <section className="admin-section">
        <div className="admin-music-head">
          <div>
            <span className="kicker">کتابخانه موسیقی</span>
            <h2>موسیقی سایت</h2>
            <p>آهنگ را اینجا آپلود کن؛ فقط آهنگ‌های فعال در پلیر عمومی سایت نمایش داده می‌شوند.</p>
          </div>
        </div>

        <form className="admin-music-upload" onSubmit={uploadTrack}>
          <label className="field">
            <span>عنوان آهنگ</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="مثلاً شب‌های اصفهان"
            />
          </label>

          <label className="field">
            <span>خواننده / هنرمند</span>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              maxLength={120}
              placeholder="نام خواننده"
            />
          </label>

          <label className="admin-music-file">
            <span>فایل صوتی</span>
            <input
              id="admin-music-file"
              type="file"
              accept=".mp3,.ogg,.wav,.m4a,.aac,audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <small>
              {file
                ? file.name + " · " + formatSize(file.size)
                : "MP3 / OGG / WAV / M4A / AAC — حداکثر ۱۰۰ مگابایت"}
            </small>
          </label>

          <button type="submit" className="btn-gold" disabled={busy || !file}>
            {busy ? <Loader2 size={16} className="admin-spin" /> : <Upload size={16} />}
            {busy ? "در حال آپلود… " + uploadProgress + "%" : "آپلود آهنگ"}
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span className="kicker">فهرست</span>
            <h2>{tracks.length.toLocaleString("fa-IR")} آهنگ</h2>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            {muted ? "بی‌صدا" : "صدا"}
          </button>
        </div>

        {loading ? (
          <div className="admin-empty">
            <Loader2 size={24} className="admin-spin" />
            <strong>در حال بارگذاری...</strong>
          </div>
        ) : tracks.length === 0 ? (
          <div className="admin-empty">
            <Music2 size={30} />
            <strong>هنوز آهنگی اضافه نشده</strong>
            <p>اولین آهنگ را از فرم بالا آپلود کن.</p>
          </div>
        ) : (
          <div className="admin-music-list">
            {tracks.map((track) => (
              <article key={track.id} className="admin-music-row">
                <button
                  type="button"
                  className="admin-icon-btn"
                  title={playingId === track.id ? "توقف" : "پخش"}
                  onClick={() => playTrack(track)}
                >
                  {playingId === track.id ? <Pause size={16} /> : <Play size={16} />}
                </button>

                <div className="admin-music-main">
                  <div className="admin-music-title-row">
                    <strong>{track.title}</strong>
                    <span className={track.active ? "admin-music-active" : "admin-music-inactive"}>
                      {track.active ? "فعال" : "خاموش"}
                    </span>
                  </div>
                  <span>
                    {track.artist || "بدون نام هنرمند"} · {formatSize(track.sizeBytes)}
                  </span>
                  {playingId === track.id ? (
                    <div className="admin-music-progress">
                      <span style={{ width: progress + "%" }} />
                    </div>
                  ) : null}
                </div>

                <div className="admin-property-actions">
                  <button
                    type="button"
                    className="admin-icon-btn"
                    title={track.active ? "غیرفعال کردن" : "فعال کردن"}
                    onClick={() => void action(track.id, "toggle", !track.active)}
                  >
                    {track.active ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn danger"
                    title="حذف"
                    onClick={() => void action(track.id, "delete")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
