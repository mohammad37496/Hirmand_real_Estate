"""Capture a local calibration frame with the configured virtual line overlaid."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import time

os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
import cv2

ROOT = Path(__file__).resolve().parent


def main() -> int:
    parser = argparse.ArgumentParser(description="Save one local XVR calibration image; it is not uploaded.")
    parser.add_argument("--camera-id", required=True, help="Camera ID from config.json")
    parser.add_argument("--config", default="config.json")
    args = parser.parse_args()
    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = ROOT / config_path
    config = json.loads(config_path.read_text(encoding="utf-8"))
    camera = next((item for item in config.get("cameras", []) if item.get("id") == args.camera_id), None)
    if camera is None:
        raise SystemExit(f"Camera ID not found: {args.camera_id}")
    env_name = str(camera.get("rtsp_url_env", ""))
    stream = os.environ.get(env_name, "").strip()
    if not stream.startswith("rtsp://"):
        raise SystemExit(f"Set the RTSP environment variable {env_name} first.")
    cap = cv2.VideoCapture(stream)
    try:
        deadline = time.monotonic() + 15
        frame = None
        while time.monotonic() < deadline:
            ok, candidate = cap.read()
            if ok and candidate is not None:
                frame = candidate
                break
        if frame is None:
            raise SystemExit("Could not read a frame from this RTSP stream.")
    finally:
        cap.release()

    h, w = frame.shape[:2]
    line = camera.get("line", {})
    x1, y1, x2, y2 = (
        round(float(line.get("x1", .5)) * w),
        round(float(line.get("y1", .1)) * h),
        round(float(line.get("x2", .5)) * w),
        round(float(line.get("y2", .9)) * h),
    )
    cv2.line(frame, (x1, y1), (x2, y2), (0, 220, 255), max(2, w // 500))
    cv2.putText(frame, "CALIBRATION LINE - LOCAL ONLY", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, max(.5, w / 1800), (0, 220, 255), 2)
    output_dir = ROOT / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / f"preview_{args.camera_id}.jpg"
    if not cv2.imwrite(str(output), frame):
        raise SystemExit("Could not write local calibration image.")
    print(f"Calibration image written locally: {output}")
    print("Review it locally, adjust line coordinates in config.json, and delete the image after calibration.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
