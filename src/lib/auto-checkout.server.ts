/**
 * Server-side 12:00 AM (Midnight IST) Auto Check-Out helper.
 * Ensures any open shift or running project session from a previous calendar day
 * (Asia/Kolkata) is automatically closed at 23:59:59 of that shift's date.
 */

export function getIstDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
}

export function getIstEndOfDayIso(istDateStr: string): string {
  return new Date(`${istDateStr}T23:59:59.000+05:30`).toISOString();
}

let lastGlobalSweepAt = 0;

/**
 * Closes any open shifts (`clock_out IS NULL`) and running project sessions
 * whose start date (in IST) is strictly before today's IST date.
 * If `userId` is omitted, sweeps all users (throttled to at most once every 60s).
 */
export async function autoCloseExpiredShiftsAndSessions(
  supabase: any,
  userId?: string,
): Promise<{ closedShifts: number; closedSessions: number }> {
  const now = Date.now();
  if (!userId && now - lastGlobalSweepAt < 60_000) {
    return { closedShifts: 0, closedSessions: 0 };
  }
  if (!userId) {
    lastGlobalSweepAt = now;
  }

  const todayIst = getIstDateString(new Date(now));
  let closedShifts = 0;
  let closedSessions = 0;

  try {
    let shiftQuery = supabase
      .from("shifts")
      .select("id, user_id, clock_in, note")
      .is("clock_out", null);
    if (userId) {
      shiftQuery = shiftQuery.eq("user_id", userId);
    }

    const { data: openShifts } = await shiftQuery;
    const expiredShifts = (openShifts ?? []).filter((s: any) => {
      if (!s.clock_in) return false;
      const shiftDateIst = getIstDateString(new Date(s.clock_in));
      return shiftDateIst < todayIst;
    });

    await Promise.all(
      expiredShifts.map(async (s: any) => {
        const shiftDateIst = getIstDateString(new Date(s.clock_in));
        const endIso = getIstEndOfDayIso(shiftDateIst);
        const autoNote = "Auto Check-Out (12:00 AM)";
        const updatedNote = s.note ? `${s.note} | ${autoNote}` : autoNote;

        let { error } = await supabase
          .from("shifts")
          .update({
            clock_out: endIso,
            clock_out_location_name: autoNote,
            note: updatedNote,
          })
          .eq("id", s.id);

        if (error && (error.message?.includes("clock_out_location_name") || error.message?.includes("schema cache"))) {
          await supabase
            .from("shifts")
            .update({
              clock_out: endIso,
              note: updatedNote,
            })
            .eq("id", s.id);
        }
        closedShifts += 1;
      }),
    );

    let sessQuery = supabase
      .from("project_sessions")
      .select("id, user_id, session_date, start_time, duration_seconds, status, end_time, daily_ended")
      .eq("daily_ended", false);
    if (userId) {
      sessQuery = sessQuery.eq("user_id", userId);
    }

    const { data: activeSessions } = await sessQuery;
    const expiredSessions = (activeSessions ?? []).filter((sess: any) => {
      const isRunning = !sess.end_time || sess.status === "In Progress";
      if (!isRunning) return false;
      const sessDateIst =
        sess.session_date ||
        (sess.start_time ? getIstDateString(new Date(sess.start_time)) : todayIst);
      return sessDateIst < todayIst;
    });

    const nowIso = new Date(now).toISOString();
    await Promise.all(
      expiredSessions.map(async (sess: any) => {
        const sessDateIst =
          sess.session_date ||
          (sess.start_time ? getIstDateString(new Date(sess.start_time)) : todayIst);
        const endIso = getIstEndOfDayIso(sessDateIst);
        const endMs = new Date(endIso).getTime();
        const startMs = sess.start_time ? new Date(sess.start_time).getTime() : endMs;
        const elapsed = isNaN(startMs) ? 0 : Math.max(0, Math.floor((endMs - startMs) / 1000));
        const updatedDuration = (sess.duration_seconds || 0) + elapsed;

        await supabase
          .from("project_sessions")
          .update({
            end_time: endIso,
            duration_seconds: updatedDuration,
            status: "Paused",
            daily_ended: true,
            updated_at: nowIso,
          })
          .eq("id", sess.id);
        closedSessions += 1;
      }),
    );
  } catch (err) {
    console.error("[autoCloseExpiredShiftsAndSessions] error:", err);
  }

  return { closedShifts, closedSessions };
}

/**
 * Closes all currently open shifts and running project sessions for a user
 * (used when the midnight 23:59:55 trigger fires).
 */
export async function closeAllActiveAtMidnight(
  supabase: any,
  userId: string,
): Promise<{ stoppedCount: number }> {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  let stoppedCount = 0;

  const [{ data: openShifts }, { data: activeSessions }] = await Promise.all([
    supabase.from("shifts").select("id, note").eq("user_id", userId).is("clock_out", null),
    supabase.from("project_sessions").select("*").eq("user_id", userId).eq("daily_ended", false),
  ]);

  const autoNote = "Auto Check-Out (12:00 AM)";
  await Promise.all(
    (openShifts ?? []).map(async (s: any) => {
      const updatedNote = s.note ? `${s.note} | ${autoNote}` : autoNote;
      let { error } = await supabase
        .from("shifts")
        .update({
          clock_out: nowIso,
          clock_out_location_name: autoNote,
          note: updatedNote,
        })
        .eq("id", s.id);
      if (error && (error.message?.includes("clock_out_location_name") || error.message?.includes("schema cache"))) {
        await supabase
          .from("shifts")
          .update({ clock_out: nowIso, note: updatedNote })
          .eq("id", s.id);
      }
      stoppedCount += 1;
    }),
  );

  const runningSessions = (activeSessions ?? []).filter(
    (s: any) => (!s.end_time || s.status === "In Progress") && !s.daily_ended,
  );

  await Promise.all(
    runningSessions.map(async (sess: any) => {
      const startMs = sess.start_time ? new Date(sess.start_time).getTime() : nowMs;
      const elapsed = isNaN(startMs) ? 0 : Math.max(0, Math.floor((nowMs - startMs) / 1000));
      const updatedDuration = (sess.duration_seconds || 0) + elapsed;

      await supabase
        .from("project_sessions")
        .update({
          end_time: nowIso,
          duration_seconds: updatedDuration,
          status: "Paused",
          daily_ended: true,
          updated_at: nowIso,
        })
        .eq("id", sess.id);
      stoppedCount += 1;
    }),
  );

  return { stoppedCount };
}
