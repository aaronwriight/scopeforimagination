export function formatSfiDate(date: string, includeYear = true): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  });
}

export function formatSfiHeaderDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${Number(month)}.${Number(day)}.${year.slice(-2)}`;
}

export function formatSfiMonth(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "long" });
}

const tagColors: Record<string, string> = {
  sfi: "#f4a825",
  venture: "#586e75",
};

export function getSfiTagColor(tag: string): string {
  const normalizedTag = tag.trim().toLowerCase();
  return tagColors[normalizedTag] ?? "#859900";
}
