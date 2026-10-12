import { supabase } from "@/lib/supabase";
import { LOG_COLS, fail, ok, toLog } from "@/lib/server";

export const dynamic = "force-dynamic";

/** De laatste 400 regels van het logboek (nieuwste eerst). */
export async function GET() {
  try {
    const { data, error } = await supabase()
      .from("activity_log")
      .select(LOG_COLS)
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) throw error;
    return ok({ entries: (data ?? []).map(toLog) });
  } catch (e) {
    return fail(e);
  }
}
