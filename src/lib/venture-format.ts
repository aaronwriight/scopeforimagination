const ordinalNames = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
] as const;

export function formatOccurrence(ordinal: number, noun: string): string {
  const ordinalName = ordinalNames[ordinal - 1] ?? formatOrdinal(ordinal);
  return `${ordinalName} ${noun}`;
}

export function formatOrdinal(value: number): string {
  return `${value}${ordinalSuffix(value)}`;
}

function ordinalSuffix(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return "th";
  if (value % 10 === 1) return "st";
  if (value % 10 === 2) return "nd";
  if (value % 10 === 3) return "rd";
  return "th";
}
