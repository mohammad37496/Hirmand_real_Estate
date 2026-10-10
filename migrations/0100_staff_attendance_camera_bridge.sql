-- Camera-assisted attendance events contain no images or biometric templates.
create table if not exists staff_attendance_camera_nonces (
  nonce text primary key,
  created_at timestamptz not null default current_timestamp,
  expires_at timestamptz not null
);

create index if not exists staff_attendance_camera_nonces_expires_idx
  on staff_attendance_camera_nonces (expires_at);

create table if not exists staff_attendance_camera_events (
  event_id text primary key,
  consultant_id text not null,
  direction text not null check (direction in ('entry', 'exit')),
  occurred_at timestamptz not null,
  camera_id text not null,
  match_score numeric(6,5) not null check (match_score >= 0 and match_score <= 1),
  status text not null default 'received'
    check (status in ('received', 'applied', 'duplicate', 'needs_review', 'reviewed')),
  result_note text not null default '',
  created_at timestamptz not null default current_timestamp,
  processed_at timestamptz
);

create index if not exists staff_attendance_camera_events_recent_idx
  on staff_attendance_camera_events (occurred_at desc);
create index if not exists staff_attendance_camera_events_employee_idx
  on staff_attendance_camera_events (consultant_id, occurred_at desc);
create index if not exists staff_attendance_camera_events_review_idx
  on staff_attendance_camera_events (status, occurred_at desc);
