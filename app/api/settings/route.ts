import { supabase } from "@/lib/supabase";
import { InputError, fail, logActivity, ok, readJson } from "@/lib/server";

export async function PUT(req: Request) {
  try {
    const db = supabase();
    const body = await readJson(req);
    const warnDays = Math.round(Number(body.warnDays));
    if (!Number.isFinite(warnDays) || warnDays < 0 || warnDays > 60) throw new InputError("Kies tussen 0 en 60 dagen.");
    const { error } = await db.from("settings").upsert({ id: 1, warn_days: warnDays });
    if (error) throw error;
    await logActivity(db, req, { action: "settings", detail: `waarschuwen ${warnDays} dagen voor de vervaldatum` });
    return ok({ warnDays });
  } catch (e) {
    return fail(e);
  }
}
