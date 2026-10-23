import { supabase } from "@/lib/supabase";
import { ORDER_COLS, fail, logActivity, ok, parseOrder, readJson, toOrder, whoFrom } from "@/lib/server";

/** Bestelling als "besteld" markeren: { supplierId, lines: [{ productId, qty }] }. */
export async function POST(req: Request) {
  try {
    const db = supabase();
    const o = parseOrder(await readJson(req));
    const { data: created, error } = await db
      .from("orders")
      .insert({ supplier_id: o.supplierId, created_by: whoFrom(req) })
      .select("id")
      .single();
    if (error) throw error;
    const id = (created as { id: string }).id;
    const { error: lineError } = await db.from("order_lines").insert(o.lines.map((l) => ({ order_id: id, product_id: l.productId, qty: l.qty })));
    if (lineError) {
      await db.from("orders").delete().eq("id", id);
      throw lineError;
    }
    const { data, error: readError } = await db.from("orders").select(ORDER_COLS).eq("id", id).single();
    if (readError) throw readError;
    const supplier = o.supplierId ? (await db.from("suppliers").select("name").eq("id", o.supplierId).maybeSingle()).data : null;
    await logActivity(db, req, {
      action: "order",
      detail: `${(supplier as { name?: string } | null)?.name ?? "zonder leverancier"} · ${o.lines.length} ${o.lines.length === 1 ? "product" : "producten"}`,
    });
    return ok(toOrder(data), 201);
  } catch (e) {
    return fail(e);
  }
}
