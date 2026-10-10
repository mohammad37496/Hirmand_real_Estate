"""Signed HTTP protocol shared by the local attendance bridge and enrolment utility."""
from __future__ import annotations
import hashlib, hmac, json, os, secrets, time
from typing import Any
from urllib.parse import urljoin
import requests

def signed_request(config: dict[str, Any], method: str, route: str, payload: dict[str, Any] | None = None) -> requests.Response:
    base_url = str(config.get("site_url", "")).strip().rstrip("/") + "/"
    if not base_url.startswith("https://"):
        raise RuntimeError("site_url must use HTTPS.")
    secret = os.environ.get("HIRMAND_ATTENDANCE_CAMERA_SECRET", "").strip()
    if len(secret) < 32:
        raise RuntimeError("Set HIRMAND_ATTENDANCE_CAMERA_SECRET to the same 32+ character secret configured on Liara.")
    body = b"" if payload is None else json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    timestamp = str(int(time.time() * 1000))
    nonce = secrets.token_urlsafe(24)
    digest = hashlib.sha256(body).hexdigest()
    canonical = f"v1.{timestamp}.{nonce}.{digest}"
    signature = hmac.new(secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()
    headers = {
        "X-Hirmand-Camera-Timestamp": timestamp,
        "X-Hirmand-Camera-Nonce": nonce,
        "X-Hirmand-Camera-Signature": signature,
        "Accept": "application/json",
        "User-Agent": "HirmandAttendanceBridge/1.0",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json; charset=utf-8"
    return requests.request(method.upper(), urljoin(base_url, route.lstrip("/")), data=body if body else None, headers=headers, timeout=float(config.get("http_timeout_seconds", 12)))
