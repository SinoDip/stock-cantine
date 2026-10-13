import { supabase } from "@/lib/supabase";
import { AREA_LABEL } from "@/lib/stock";
import { BATCH_COLS, fail, logActivity, ok, parseBatch, productName, readJson, toBatch } from "@/lib/server";

/** Nieuwe levering of prep inboeken. */
export async function POST(req: Request) {
  try {
    const db = supabase();
    const b = parseBatch(await readJson(req));
    const { data, error } = await db
      .from("batches")
      .insert({
        product_id: b.productId,
        area: b.area,
        qty: b.qty,
        remaining: b.qty,
        received: b.received,
        expires: b.expires,
        note: b.note,
        created_by: b.createdBy,
      })
      .select(BATCH_COLS)
      .single();
    if (error) throw error;
    await logActivity(db, req, {
      action: "add",
      productId: b.productId,
      productName: await productName(db, b.productId),
      qty: b.qty,
      detail: AREA_LABEL[b.area] + (b.expires ? ` · houdbaar tot ${b.expires}` : ""),
    });
    return ok(toBatch(data), 201);
  } catch (e) {
    return fail(e);
  }
}
