/**
 * Displays a compact confidence badge indicating whether a shift location
 * was verified by precise GPS, network/Wi-Fi, or IP fallback.
 */
export function LocationAccuracyBadge({
  accuracy,
  locationName,
}: {
  accuracy?: number | null;
  locationName?: string | null;
}) {
  const isIp =
    locationName?.includes("Verified via IP") ||
    locationName?.includes("(IP Based)") ||
    (typeof accuracy === "number" && accuracy >= 10000);

  if (isIp) {
    return (
      <span
        title="Approximate location from desktop IP address"
        className="inline-flex items-center rounded border border-slate-500/30 bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-300"
      >
        IP ~10km
      </span>
    );
  }

  if (typeof accuracy !== "number" || accuracy <= 0) {
    return null;
  }

  if (accuracy <= 150) {
    return (
      <span
        title={`Satellite GPS accuracy: ±${accuracy} meters`}
        className="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
      >
        GPS ±{accuracy}m
      </span>
    );
  }

  if (accuracy <= 500) {
    return (
      <span
        title={`Moderate accuracy: ±${accuracy} meters`}
        className="inline-flex items-center rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400"
      >
        GPS ±{accuracy}m
      </span>
    );
  }

  const label = accuracy >= 1000 ? `~${(accuracy / 1000).toFixed(1)}km` : `~${accuracy}m`;
  return (
    <span
      title={`Low-confidence network/laptop reading (±${accuracy}m)`}
      className="inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
    >
      Network {label}
    </span>
  );
}
