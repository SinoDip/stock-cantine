import { supabase } from "@/lib/supabase";
import { InputError, fail, logActivity, ok, productName, readJson, toBatch } from "@/lib/server";

/**
 * Eén stuk van een product gebruikt: trekt af van de levering die het eerst vervalt.
 * Gebeurt in één databasefunctie, zodat twee mensen tegelijk tikken niet botst.
 * Geeft de levering terug zoals ze vóór de wijziging was (voor "Ongedaan maken").
 */
export async function POST(req: Request) {
  try {
    const db = supabase();
    const body = await readJson(req);
    if (typeof body.productId !== "string") throw new InputError("Product ontbreekt.");
    const amount = body.amount === undefined ? 1 : Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new InputError("Ongeldig aantal.");
    const { data, error } = await db.rpc("use_one", { p_product: body.productId, p_amount: amount });
    if (error) throw error;
    if (data) {
      await logActivity(db, req, {
        action: "use",
        productId: body.productId,
        productName: await productName(db, body.productId),
        qty: -amount,
      });
    }
    return ok({ before: data ? toBatch(data) : null });
  } catch (e) {
    return fail(e);
  }
}
