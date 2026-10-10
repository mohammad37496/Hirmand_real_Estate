"""Local encrypted storage and enrolment helpers. Face vectors never leave this computer."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from cryptography.fernet import Fernet


def build_face_model():
    # InsightFace downloads its model weights on the first run if they are not cached.
    from insightface.app import FaceAnalysis

    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    return app


def ensure_vault_key(key_path: Path) -> bytes:
    key_path.parent.mkdir(parents=True, exist_ok=True)
    if not key_path.exists():
        key_path.write_bytes(Fernet.generate_key())
        try:
            os.chmod(key_path, 0o600)
        except OSError:
            pass
    return key_path.read_bytes().strip()


def load_vault(vault_path: Path, key_path: Path) -> dict[str, Any]:
    if not vault_path.exists():
        return {"version": 1, "employees": {}}
    if not key_path.exists():
        raise RuntimeError(f"Template encryption key is missing: {key_path}")
    cipher = Fernet(key_path.read_bytes().strip())
    try:
        value = json.loads(cipher.decrypt(vault_path.read_bytes()).decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("Could not decrypt local face templates. Check the key file and backups.") from exc
    if not isinstance(value, dict) or not isinstance(value.get("employees"), dict):
        raise RuntimeError("The local template vault has an unexpected format.")
    return value


def save_vault(vault_path: Path, key_path: Path, value: dict[str, Any]) -> None:
    key = ensure_vault_key(key_path)
    vault_path.parent.mkdir(parents=True, exist_ok=True)
    plaintext = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    temporary = vault_path.with_suffix(vault_path.suffix + ".tmp")
    temporary.write_bytes(Fernet(key).encrypt(plaintext))
    try:
        os.chmod(temporary, 0o600)
    except OSError:
        pass
    temporary.replace(vault_path)


def extract_employee_template(model: Any, image_paths: list[str]) -> list[float]:
    vectors: list[np.ndarray] = []
    for path in image_paths:
        image = cv2.imread(str(path))
        if image is None:
            raise RuntimeError(f"Could not read enrolment image: {path}")
        faces = model.get(image)
        if len(faces) != 1:
            raise RuntimeError(f"Each enrolment photo must show exactly one face: {path}")
        face = faces[0]
        if float(getattr(face, "det_score", 0.0)) < 0.65:
            raise RuntimeError(f"Face quality is too low in this photo: {path}")
        vector = np.asarray(face.normed_embedding, dtype=np.float32)
        norm = float(np.linalg.norm(vector))
        if norm <= 0:
            raise RuntimeError(f"Could not create a usable template from: {path}")
        vectors.append(vector / norm)
    if len(vectors) < 3:
        raise RuntimeError("Use at least three clear, current, front-facing photos for enrolment.")
    mean = np.mean(np.stack(vectors), axis=0)
    norm = float(np.linalg.norm(mean))
    if norm <= 0:
        raise RuntimeError("Could not combine the enrolment templates.")
    return (mean / norm).astype(np.float32).tolist()


def enroll_employee(
    model: Any,
    config: dict[str, Any],
    employee_id: str,
    employee_name: str,
    image_paths: list[str],
) -> None:
    vault_path = Path(config.get("template_file", "data/staff_faces.enc"))
    key_path = Path(config.get("key_file", "data/template.key"))
    if not vault_path.is_absolute():
        vault_path = Path(__file__).resolve().parent / vault_path
    if not key_path.is_absolute():
        key_path = Path(__file__).resolve().parent / key_path
    vault = load_vault(vault_path, key_path)
    embedding = extract_employee_template(model, image_paths)
    vault.setdefault("employees", {})[employee_id] = {
        "name": employee_name.strip(),
        "embedding": embedding,
        "enrolled_at": datetime.now(timezone.utc).isoformat(),
        "consent_recorded_locally": True,
    }
    vault["version"] = 1
    save_vault(vault_path, key_path, vault)
