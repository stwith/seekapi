import { randomUUID } from "node:crypto";

/** Generate a prefixed request identifier. */
export function generateRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}
