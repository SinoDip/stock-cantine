import { supabase } from "@/lib/supabase";
import { PRODUCT_COLS, fail, logActivity, ok, parseProduct, productRow, readJson, toProduct } from "@/lib/server";

export async function POST(req: Request) {
  try {
    const db = supabase();
    const input = parseProduct(await readJson(req));
    const { data, error } = await db.from("products").insert(productRow(input)).select(PRODUCT_COLS).single();
    if (error) throw error;
    const p = toProduct(data);
    await logActivity(db, req, { action: "product_add", productId: p.id, productName: p.name });
    return ok(p, 201);
  } catch (e) {
    return fail(e);
  }
}
