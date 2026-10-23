import { supabase } from "@/lib/supabase";
import { AREA_LABEL, fmtNum } from "@/lib/stock";
import { fail, logActivity, ok, parseCount, productName, readJson, whoFrom } from "@/lib/server";

/** Telling opslaan: { area, counts: [{ productId, qty }] }. Zet per product de stock op het getelde aantal. */
export async function POST(req: Request) {
  try {
    const db = supabase();
    const { area, counts } = parseCount(await readJson(req));
    const who = whoFrom(req);
    let changed = 0;
    for (const c of counts) {
      const { data, error } = await db.rpc("set_count", { p_product: c.productId, p_area: area, p_qty: c.qty, p_who: who });
      if (error) throw error;
      const before = Number(data ?? 0);
      if (before === c.qty) continue;
      changed++;
      await logActivity(db, req, {
        action: "count",
        productId: c.productId,
        productName: await productName(db, c.productId),
        qty: c.qty,
        detail: `${AREA_LABEL[area]} · was ${fmtNum(before)}`,
      });
    }
    return ok({ changed });
  } catch (e) {
    return fail(e);
  }
}
