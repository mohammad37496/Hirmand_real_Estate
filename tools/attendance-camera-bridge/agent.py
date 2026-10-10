"""Office-local Dahua RTSP -> staff attendance bridge.

Video frames and face embeddings are processed locally. Only a matched employee ID,
direction, timestamp, camera ID and similarity score are sent to the Hirmand API.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# OpenCV uses TCP for a more reliable RTSP connection on typical office networks.
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

import cv2
import numpy as np

from face_db import build_face_model, load_vault
from protocol import signed_request

ROOT = Path(__file__).resolve().parent


def relative_path(config: dict[str, Any], key: str, fallback: str) -> Path:
    value = Path(str(config.get(key, fallback)))
    return value if value.is_absolute() else ROOT / value


class LocalOutbox:
    """Durable retry queue; camera events survive temporary site/internet outages."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute(
                "CREATE TABLE IF NOT EXISTS pending_events ("
                "event_id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at REAL NOT NULL, "
                "attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at REAL NOT NULL DEFAULT 0)"
            )
            conn.commit()

    def put(self, payload: dict[str, Any]) -> None:
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.execute(
                "INSERT OR IGNORE INTO pending_events(event_id,payload,created_at,next_attempt_at) VALUES(?,?,?,0)",
                (payload["eventId"], json.dumps(payload, ensure_ascii=False, separators=(",", ":")), time.time()),
            )
            conn.commit()

    def next_due(self) -> tuple[str, str, int] | None:
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            row = conn.execute(
                "SELECT event_id,payload,attempts FROM pending_events "
                "WHERE next_attempt_at<=? ORDER BY created_at LIMIT 1",
                (time.time(),),
            ).fetchone()
            return (str(row[0]), str(row[1]), int(row[2])) if row else None

    def delivered(self, event_id: str) -> None:
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.execute("DELETE FROM pending_events WHERE event_id=?", (event_id,))
            conn.commit()

    def failed(self, event_id: str, attempts: int, delay_seconds: float) -> None:
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            conn.execute(
                "UPDATE pending_events SET attempts=?,next_attempt_at=? WHERE event_id=?",
                (attempts + 1, time.time() + delay_seconds, event_id),
            )
            conn.commit()

    def size(self) -> int:
        with sqlite3.connect(self.db_path, timeout=10) as conn:
            row = conn.execute("SELECT count(*) FROM pending_events").fetchone()
            return int(row[0] if row else 0)


def request_sender(config: dict[str, Any], outbox: LocalOutbox, stop: threading.Event) -> None:
    while not stop.is_set():
        item = outbox.next_due()
        if item is None:
            stop.wait(1.0)
            continue
        event_id, raw_payload, attempts = item
        try:
            payload = json.loads(raw_payload)
            response = signed_request(config, "POST", "/api/attendance-camera-event", payload)
            result: dict[str, Any] = {}
            try:
                result = response.json()
            except ValueError:
                pass
            if response.ok and result.get("ok") is True:
                outbox.delivered(event_id)
                print(f"[api] {event_id[:8]} status={result.get('status', 'accepted')} queue={outbox.size()}")
                continue
            delay = min(300.0, max(10.0, 2.0 ** min(attempts + 1, 8)))
            if response.status_code in (400, 403, 422):
                delay = 300.0
            outbox.failed(event_id, attempts, delay)
            print(f"[api] event retained for retry (HTTP {response.status_code}); queue={outbox.size()}")
        except Exception as exc:
            delay = min(300.0, max(5.0, 2.0 ** min(attempts + 1, 8)))
            outbox.failed(event_id, attempts, delay)
            print(f"[api] delivery unavailable; event retained ({type(exc).__name__}); queue={outbox.size()}")


class CameraWorker(threading.Thread):
    def __init__(
        self,
        camera: dict[str, Any],
        stream_url: str,
        config: dict[str, Any],
        model: Any,
        model_lock: threading.Lock,
        templates: dict[str, dict[str, Any]],
        outbox: LocalOutbox,
        stop: threading.Event,
    ):
        super().__init__(name=f"camera-{camera['id']}", daemon=True)
        self.camera = camera
        self.stream_url = stream_url
        self.config = config
        self.model = model
        self.model_lock = model_lock
        self.templates = templates
        self.outbox = outbox
        self.stop_event = stop
        self.tracks: dict[str, dict[str, Any]] = {}
        self.last_crossing: dict[str, float] = {}
        self.next_inference = 0.0

    def line_values(self) -> tuple[float, float, float, float]:
        line = self.camera.get("line", {})
        return tuple(float(line.get(key, default)) for key, default in (
            ("x1", 0.5), ("y1", 0.1), ("x2", 0.5), ("y2", 0.9)
        ))  # type: ignore[return-value]

    def signed_distance(self, point: tuple[float, float]) -> float:
        x1, y1, x2, y2 = self.line_values()
        dx, dy = x2 - x1, y2 - y1
        length = max((dx * dx + dy * dy) ** 0.5, 1e-6)
        return (dx * (point[1] - y1) - dy * (point[0] - x1)) / length

    def stable_side(self, point: tuple[float, float]) -> int:
        distance = self.signed_distance(point)
        if distance > 0.006:
            return 1
        if distance < -0.006:
            return -1
        return 0

    def crosses_segment(self, previous: tuple[float, float], current: tuple[float, float]) -> bool:
        start = self.signed_distance(previous)
        finish = self.signed_distance(current)
        if start == finish or start * finish > 0:
            return False
        ratio = start / (start - finish)
        crossing_x = previous[0] + ratio * (current[0] - previous[0])
        crossing_y = previous[1] + ratio * (current[1] - previous[1])
        x1, y1, x2, y2 = self.line_values()
        dx, dy = x2 - x1, y2 - y1
        length_sq = dx * dx + dy * dy
        if length_sq <= 1e-8:
            return False
        projection = ((crossing_x - x1) * dx + (crossing_y - y1) * dy) / length_sq
        return 0.0 <= projection <= 1.0

    def best_match(self, embedding: np.ndarray) -> tuple[str | None, float]:
        best_id: str | None = None
        best_score = -1.0
        for employee_id, row in self.templates.items():
            template = np.asarray(row.get("embedding", []), dtype=np.float32)
            if template.shape != embedding.shape:
                continue
            score = float(np.dot(embedding, template))
            if score > best_score:
                best_id, best_score = employee_id, score
        return best_id, max(0.0, min(1.0, best_score))

    def emit(self, employee_id: str, score: float, direction: str) -> None:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        payload = {
            "eventId": str(uuid.uuid4()),
            "consultantId": employee_id,
            "direction": direction,
            "occurredAt": now,
            "cameraId": str(self.camera["id"]),
            "matchScore": round(float(score), 5),
        }
        self.outbox.put(payload)
        print(f"[{self.camera['id']}] queued {direction} event for enrolled staff ID {employee_id}")

    def process_frame(self, frame: np.ndarray, now: float) -> None:
        height, width = frame.shape[:2]
        if width <= 0 or height <= 0:
            return
        with self.model_lock:
            faces = self.model.get(frame)
        seen: set[str] = set()
        threshold = float(self.config.get("match_threshold", 0.50))
        min_detection = float(self.config.get("minimum_face_detection_score", 0.65))
        entry_when = str(self.camera.get("entry_when", "negative_to_positive"))
        if entry_when not in ("negative_to_positive", "positive_to_negative"):
            print(f"[{self.camera['id']}] invalid entry_when; camera skipped")
            return

        for face in faces:
            if float(getattr(face, "det_score", 0.0)) < min_detection:
                continue
            embedding = np.asarray(getattr(face, "normed_embedding", []), dtype=np.float32)
            if embedding.ndim != 1 or embedding.size == 0:
                continue
            norm = float(np.linalg.norm(embedding))
            if norm <= 0:
                continue
            embedding = embedding / norm
            employee_id, score = self.best_match(embedding)
            if employee_id is None or score < threshold:
                continue

            seen.add(employee_id)
            box = np.asarray(face.bbox, dtype=np.float32)
            center = (float((box[0] + box[2]) / 2 / width), float((box[1] + box[3]) / 2 / height))
            side = self.stable_side(center)
            if side == 0:
                continue
            previous = self.tracks.get(employee_id)
            stable_count = 1
            if previous and now - float(previous["last_seen"]) <= 1.5 and int(previous["side"]) == side:
                stable_count = int(previous["stable_count"]) + 1

            if previous:
                elapsed = now - float(previous["last_seen"])
                prior_side = int(previous["side"])
                prior_point = tuple(previous["point"])
                if (
                    prior_side != side
                    and elapsed <= 5.0
                    and int(previous["stable_count"]) >= 2
                    and self.crosses_segment(prior_point, center)
                    and now - self.last_crossing.get(employee_id, 0.0)
                    >= float(self.config.get("crossing_cooldown_seconds", 12))
                ):
                    transition = "negative_to_positive" if prior_side < side else "positive_to_negative"
                    direction = "entry" if transition == entry_when else "exit"
                    self.last_crossing[employee_id] = now
                    self.emit(employee_id, score, direction)

            self.tracks[employee_id] = {
                "side": side,
                "point": center,
                "last_seen": now,
                "stable_count": stable_count,
                "score": score,
            }

        # Forget tracks after a short occlusion so a returning employee can be reacquired.
        for employee_id, track in list(self.tracks.items()):
            if now - float(track["last_seen"]) > 8.0 and employee_id not in seen:
                del self.tracks[employee_id]

    def run(self) -> None:
        interval = max(0.15, float(self.config.get("frame_interval_seconds", 0.25)))
        print(f"[{self.camera['id']}] starting local video processing")
        while not self.stop_event.is_set():
            try:
                cap = cv2.VideoCapture(
                    self.stream_url,
                    cv2.CAP_FFMPEG,
                    [
                        cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000,
                        cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000,
                    ],
                )
            except (TypeError, cv2.error):
                cap = cv2.VideoCapture(self.stream_url)
            if not cap.isOpened():
                cap.release()
                print(f"[{self.camera['id']}] RTSP unavailable; retrying in 5 seconds")
                self.stop_event.wait(5)
                continue
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            print(f"[{self.camera['id']}] RTSP connected")
            while not self.stop_event.is_set():
                ok, frame = cap.read()
                if not ok or frame is None:
                    print(f"[{self.camera['id']}] stream read failed; reconnecting")
                    break
                now = time.monotonic()
                if now >= self.next_inference:
                    self.next_inference = now + interval
                    try:
                        self.process_frame(frame, now)
                    except Exception as exc:
                        print(f"[{self.camera['id']}] frame processing error: {type(exc).__name__}")
            cap.release()
            if not self.stop_event.is_set():
                self.stop_event.wait(2)
        print(f"[{self.camera['id']}] stopped")


def main() -> int:
    config_path = Path(os.environ.get("HIRMAND_ATTENDANCE_CONFIG", ROOT / "config.json"))
    if not config_path.is_absolute():
        config_path = ROOT / config_path
    if not config_path.exists():
        raise SystemExit(f"Config file not found: {config_path}. Copy config.example.json to config.json first.")
    config = json.loads(config_path.read_text(encoding="utf-8"))

    vault_path = relative_path(config, "template_file", "data/staff_faces.enc")
    key_path = relative_path(config, "key_file", "data/template.key")
    vault = load_vault(vault_path, key_path)
    templates = vault.get("employees", {})
    if not templates:
        raise SystemExit("No staff templates enrolled. Run enroll.py first.")
    model = build_face_model()
    outbox = LocalOutbox(relative_path(config, "outbox_file", "data/outbox.sqlite3"))
    stop = threading.Event()
    sender = threading.Thread(target=request_sender, args=(config, outbox, stop), name="attendance-api-sender", daemon=True)
    sender.start()

    workers: list[CameraWorker] = []
    model_lock = threading.Lock()
    for camera in config.get("cameras", []):
        if not camera.get("enabled", True):
            continue
        env_name = str(camera.get("rtsp_url_env", "")).strip()
        stream_url = os.environ.get(env_name, "").strip() if env_name else ""
        if not stream_url:
            print(f"[{camera.get('id', 'camera')}] skipped; environment variable {env_name or '(missing)'} is empty")
            continue
        if not stream_url.lower().startswith("rtsp://"):
            print(f"[{camera.get('id', 'camera')}] skipped; stream URL must use rtsp://")
            continue
        worker = CameraWorker(camera, stream_url, config, model, model_lock, templates, outbox, stop)
        worker.start()
        workers.append(worker)

    if not workers:
        stop.set()
        raise SystemExit("No enabled camera has a configured RTSP environment variable.")
    print(f"Hirmand attendance bridge running with {len(workers)} camera(s). Press Ctrl+C to stop.")
    try:
        while not stop.wait(1):
            pass
    except KeyboardInterrupt:
        print("Stopping bridge...")
        stop.set()
    for worker in workers:
        worker.join(timeout=7)
    sender.join(timeout=3)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
