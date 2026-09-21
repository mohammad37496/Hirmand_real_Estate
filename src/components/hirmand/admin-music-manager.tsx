import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FileAudio, Loader2, Music2, Pause, Play, Trash2, Upload, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

type AdminMusicTrack = { id: string; title: string; artist: string; url: string; mimeType: string; sizeBytes: number; active: boolean; position: number; createdAt: string };
type UploadStage = "idle" | "preparing" | "uploading" | "saving";
const MAX_BYTES = 100 * 1024 * 1024;

function formatSize(bytes: number) {
  return bytes > 0 ? (bytes / 1024 / 1024).toFixed(1) + " MB" : "—";
}

function isAutoplayBlocked(error: unknown) {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

function audioMimeType(file: File) {
  const type = file.type.trim().toLowerCase();
  const normalized = type === "audio/mp3" ? "audio/mpeg" : type;
  if ([
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
  ].includes(normalized)) {
    return normalized;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "ogg" || extension === "oga") return "audio/ogg";
  if (extension === "wav") return "audio/wav";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "aac") return "audio/aac";
  return "";
}

function normalizedAudioFile(file: File) {
  const mimeType = audioMimeType(file);
  if (!mimeType) return null;
  if (file.type === mimeType) return { file, mimeType };
  return {
    file: new File([file], file.name, { type: mimeType, lastModified: file.lastModified }),
    mimeType,
  };
}

export function AdminMusicManager() {
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
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/music-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      if (!response.ok) throw new Error("بارگذاری آهنگ‌ها انجام نشد.");
      const data = (await response.json()) as { tracks?: AdminMusicTrack[] };
      setTracks(Array.isArray(data.tracks) ? data.tracks : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری آهنگ‌ها انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

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

    if (file.size > MAX_BYTES) {
      toast.error("حجم فایل صوتی بیشتر از ۱۰۰ مگابایت است.");
      return;
    }

    const normalized = normalizedAudioFile(file);
    if (!normalized) {
      toast.error("فرمت فایل صوتی پشتیبانی نمی‌شود. MP3، OGG، WAV، M4A یا AAC انتخاب کنید.");
      return;
    }

    setBusy(true);
    setUploadProgress(0);
    setUploadStage("preparing");
    const uploadAbort = new AbortController();
    uploadAbortRef.current = uploadAbort;

    try {
      const uploadFile = normalized.file;
      const uploadMimeType = normalized.mimeType;
      const safeName = uploadFile.name
        .replace(/[^\\w.\\u0600-\\u06FF-]+/g, "-")
        .slice(0, 100);
      const pathname = "music/" + Date.now() + "-" + safeName;

      // Direct browser-to-Blob upload keeps large files out of the
      // serverless request body. Multipart mode adds chunking/retries.
      setUploadStage("uploading");
      const blob = await upload(pathname, uploadFile, {
        access: "public",
        handleUploadUrl: "/api/music-upload",
        clientPayload: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          contentType: uploadMimeType,
          sizeBytes: uploadFile.size,
        }),
        contentType: uploadMimeType,
        multipart: uploadFile.size >= 5 * 1024 * 1024,
        abortSignal: uploadAbort.signal,
        onUploadProgress: (event) => {
          setUploadProgress(Math.max(0, Math.min(100, event.percentage)));
        },
      });

      setUploadProgress(100);
      setUploadStage("saving");

      const response = await fetch("/api/music-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: title.trim(),
          artist: artist.trim(),
          url: blob.url,
          mimeType: uploadMimeType || blob.contentType || "audio/mpeg",
          sizeBytes: uploadFile.size,
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
      if (error instanceof DOMException && error.name === "AbortError") {
        toast.info("آپلود لغو شد.");
      } else {
        toast.error(
          error instanceof Error ? error.message : "آپلود آهنگ انجام نشد.",
        );
      }
    } finally {
      uploadAbortRef.current = null;
      setBusy(false);
      setUploadStage("idle");
      setUploadProgress(0);
    }
  }

  function cancelUpload() {
    uploadAbortRef.current?.abort();
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
      // Use the public Blob object first; keep the same-origin stream endpoint
      // as a fallback for older records or unusual storage URLs.
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
        body: JSON.stringify({ action: actionName, id, active }),
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
            <span className={file ? "admin-music-file-card is-selected" : "admin-music-file-card"}>
              <span className="admin-music-file-icon">
                <FileAudio size={18} />
              </span>
              <span className="admin-music-file-copy">
                <strong>{file ? file.name : "انتخاب فایل صوتی"}</strong>
                <small>
                  {file
                    ? formatSize(file.size)
                    : "MP3 / OGG / WAV / M4A / AAC · حداکثر ۱۰۰ مگابایت"}
                </small>
              </span>
              <Upload size={16} />
            </span>
          </label>

          <div className="admin-music-upload-actions">
            <button type="submit" className="btn-gold" disabled={busy || !file}>
              {busy ? <Loader2 size={16} className="admin-spin" /> : <Upload size={16} />}
              {uploadStage === "preparing"
                ? "در حال آماده‌سازی…"
                : uploadStage === "uploading"
                  ? "در حال آپلود… " + uploadProgress + "%"
                  : uploadStage === "saving"
                    ? "در حال ثبت…"
                    : "آپلود آهنگ"}
            </button>
            {busy ? (
              <button type="button" className="btn-ghost" onClick={cancelUpload}>
                لغو
              </button>
            ) : null}
          </div>
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
