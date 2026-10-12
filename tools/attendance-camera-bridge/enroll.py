"""Enrol a consenting staff member's face template locally, or list active Hirmand staff IDs."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from face_db import build_face_model, enroll_employee
from protocol import signed_request


def main() -> int:
    parser = argparse.ArgumentParser(description="Hirmand attendance bridge enrolment")
    parser.add_argument("--config", default="config.json", help="Path to your local config JSON")
    parser.add_argument("--list-staff", action="store_true", help="Fetch active staff IDs securely from Hirmand")
    parser.add_argument("--employee-id", help="Existing consultant ID from the Hirmand staff list")
    parser.add_argument("--name", help="Staff name (used only in the local encrypted vault)")
    parser.add_argument("--images", nargs="*", default=[], help="At least three clear photos of this staff member")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = Path(__file__).resolve().parent / config_path
    config = json.loads(config_path.read_text(encoding="utf-8"))

    if args.list_staff:
        response = signed_request(config, "GET", "/api/attendance-camera-staff")
        response.raise_for_status()
        result = response.json()
        for staff in result.get("staff", []):
            print(f"{staff.get('id')}\t{staff.get('name')}\t{staff.get('role')}")
        return 0

    if not args.employee_id or not args.name or len(args.images) < 3:
        parser.error("Provide --employee-id, --name and at least three --images, or use --list-staff.")
    model = build_face_model(config)
    enroll_employee(model, config, args.employee_id.strip(), args.name.strip(), args.images)
    print("Encrypted local face template saved. Source photos were not copied by this tool.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
