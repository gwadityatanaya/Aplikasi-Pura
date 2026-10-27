import "server-only";
import { db, schema, type Tx } from "./db";
import { clientIp, userAgent } from "./http";

export interface Actor {
  id: string | null;
  name: string;
  email?: string | null;
}

export interface LogInput {
  actor: Actor;
  action: string;
  entity: string;
  detail: string;
  templeId?: string | null;
  entityId?: string | null;
  changes?: unknown;
  req?: Request;
}

/** Appends one row to the immutable activity log. Pass `tx` to log inside the same database transaction. */
export async function logActivity(input: LogInput, tx?: Tx) {
  const runner = tx ?? db;
  await runner.insert(schema.activityLog).values({
    actorId: input.actor.id,
    actorName: input.actor.name,
    actorEmail: input.actor.email ?? null,
    templeId: input.templeId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    detail: input.detail.slice(0, 1000),
    changes: input.changes ?? null,
    ip: input.req ? clientIp(input.req) : null,
    userAgent: input.req ? userAgent(input.req) : null,
  });
}

/** Field-by-field difference between two objects, for "changed X from A to B" entries. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>, fields: string[]) {
  const out: Record<string, { dari: unknown; menjadi: unknown }> = {};
  for (const f of fields) {
    if (after[f] === undefined) continue;
    const a = before[f] ?? null;
    const b = after[f] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out[f] = { dari: typeof a === "string" && a.startsWith("data:") ? "(gambar)" : a, menjadi: typeof b === "string" && b.startsWith("data:") ? "(gambar baru)" : b };
  }
  return Object.keys(out).length ? out : null;
}
