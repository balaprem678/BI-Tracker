/**
 * Standard Time & Duration Formatting Utilities
 * Standardizes time calculation display across the entire application into "Xh Ym" compact format.
 * Examples:
 *   68.82 hours -> "68h 49m"
 *   31.28 hours -> "31h 17m"
 *   1.12 hours  -> "1h 7m"
 *   0.11 hours  -> "7m"
 *   36 seconds  -> "36s"
 *   0           -> "0m"
 */

export function formatDurationSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds <= 0) return "0m";
  const s = Math.max(0, Math.round(totalSeconds));

  // If under 60 seconds, display exact seconds (e.g. "36s")
  if (s < 60) {
    return `${s}s`;
  }

  const hrs = Math.floor(s / 3600);
  const remainingSecs = s % 3600;
  const mins = Math.round(remainingSecs / 60);

  // If rounded minutes rolls over to 60
  if (mins === 60) {
    return `${hrs + 1}h`;
  }

  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }

  return `${mins}m`;
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours) || hours <= 0) return "0m";
  const totalSeconds = Math.round(hours * 3600);
  return formatDurationSeconds(totalSeconds);
}

/**
 * Standard digital clock display (HH:MM:SS) used for live active running stopwatches.
 */
export function formatTimerClock(totalSeconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(totalSeconds ?? 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
