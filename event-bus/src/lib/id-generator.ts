function compactDate(now: Date): string {
  const year = now.getUTCFullYear().toString();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  const second = String(now.getUTCSeconds()).padStart(2, "0");
  const millis = String(now.getUTCMilliseconds()).padStart(3, "0");
  return `${year}${month}${day}${hour}${minute}${second}${millis}`;
}

function normalizePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function randomSuffix(length = 6): string {
  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, "0");
}

export function generateEventId(source: string, now = new Date()): string {
  return `evt_${compactDate(now)}_${normalizePart(source)}_${randomSuffix(6)}`;
}

export function generateDeliveryStatusId(eventId: string, targetService: string): string {
  return `del_${eventId}_${normalizePart(targetService)}_${randomSuffix(5)}`;
}
