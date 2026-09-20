/**
 * Minimal `clsx`-style class name combiner.
 * Filters out falsy values so conditional classes can be written inline:
 *   cn("card", isActive && "card--active")
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
