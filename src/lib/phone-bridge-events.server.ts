import { randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";

export type PhoneBridgeEventSeverity = "info" | "warning" | "error" | "critical";

type EventMetadataValue = string | number | boolean | null;
type EventMetadata = Record<string, EventMetadataValue>;

export async function recordPhoneBridgeEvent(input: {
  deviceId?: string | null;
  actorAccountId?: string | null;
  eventType: string;
  severity?: PhoneBridgeEventSeverity;
  message: string;
  metadata?: EventMetadata;
}) {
  if (dbSource === "unconfigured") return;

  const sql = await getSql();
  await sql.query(
    `insert into phone_bridge_events
      (id,device_id,actor_account_id,event_type,severity,message,metadata)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      randomUUID(),
      input.deviceId?.trim().slice(0, 120) || null,
      input.actorAccountId?.trim().slice(0, 120) || null,
      input.eventType.trim().slice(0, 100),
      input.severity ?? "info",
      input.message.trim().slice(0, 500),
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
