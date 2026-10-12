import { supabase } from "@/lib/supabase";
import { BATCH_COLS, PRODUCT_COLS, SUPPLIER_COLS, fail, ok, toBatch, toProduct, toSupplier } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Alles in één keer: producten, leveringen met stock, leveranciers en de instellingen. */
export async function GET() {
  try {
    const db = supabase();
    const [p, b, l, s] = await Promise.all([
      db.from("products").select(PRODUCT_COLS).order("name"),
      db.from("batches").select(BATCH_COLS).gt("remaining", 0),
      db.from("suppliers").select(SUPPLIER_COLS).order("name"),
      db.from("settings").select("warn_days").eq("id", 1).maybeSingle(),
    ]);
    if (p.error) throw p.error;
    if (b.error) throw b.error;
    if (l.error) throw l.error;
    if (s.error) throw s.error;
    return ok({
      products: (p.data ?? []).map(toProduct),
      batches: (b.data ?? []).map(toBatch),
      suppliers: (l.data ?? []).map(toSupplier),
      settings: { warnDays: s.data?.warn_days ?? 3 },
    });
  } catch (e) {
    return fail(e);
  }
}
