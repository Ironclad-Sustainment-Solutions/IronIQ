import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Every DATE/TIMESTAMPTZ Postgres column comes back from node-pg as a
 * native JS Date object, not a string — rendering one directly as a JSX
 * child throws "Objects are not valid as a React child (found: [object
 * Date])" (React error #31). This is the shared fix: accepts either
 * shape (a Date object from a raw query result, or a string from
 * already-serialized/form data) and always returns a plain, renderable
 * string.
 */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
