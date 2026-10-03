const TIME_ZONE = "Asia/Kuching";

function parts(date: Date): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function kuchingInputParts(date = new Date()): { date: string; time: string } {
  const value = parts(date);
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
}

export function fromKuchingInput(date: string, time: string): string {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

export function formatKuchingDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function cycleAge(openingTimestamp: string | null, now = new Date()): string {
  if (!openingTimestamp) return "Not started";
  const days = Math.max(0, Math.floor((now.getTime() - new Date(openingTimestamp).getTime()) / 86_400_000));
  return days === 1 ? "1 day" : `${days} days`;
}
