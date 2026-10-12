import { supabase } from "@/lib/supabase";
import { SUPPLIER_COLS, fail, logActivity, ok, parseSupplier, readJson, supplierRow, toSupplier } from "@/lib/server";

export async function POST(req: Request) {
  try {
    const db = supabase();
    const input = parseSupplier(await readJson(req));
    const { data, error } = await db.from("suppliers").insert(supplierRow(input)).select(SUPPLIER_COLS).single();
    if (error) throw error;
    const s = toSupplier(data);
    await logActivity(db, req, { action: "supplier_add", detail: s.name });
    return ok(s, 201);
  } catch (e) {
    return fail(e);
  }
}
