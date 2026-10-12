import { supabase } from "@/lib/supabase";
import { PRODUCT_COLS, fail, logActivity, ok, parseProduct, productName, productRow, readJson, toProduct } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = supabase();
    const input = parseProduct(await readJson(req));
    const { data, error } = await db.from("products").update(productRow(input)).eq("id", id).select(PRODUCT_COLS).single();
    if (error) throw error;
    const p = toProduct(data);
    await logActivity(db, req, { action: "product_edit", productId: p.id, productName: p.name });
    return ok(p);
  } catch (e) {
    return fail(e);
  }
}

/** Verwijdert het product én al zijn leveringen (cascade in de database). */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = supabase();
    const name = await productName(db, id);
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) throw error;
    await logActivity(db, req, { action: "product_delete", productId: id, productName: name });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
