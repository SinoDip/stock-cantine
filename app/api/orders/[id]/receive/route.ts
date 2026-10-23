import { supabase } from "@/lib/supabase";
import { AREA_LABEL } from "@/lib/stock";
import { BATCH_COLS, InputError, fail, logActivity, ok, parseReceive, readJson, toBatch, whoFrom } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Bestelling ontvangen: { received, lines: [{ productId, qty, area, expires }] }.
 * Boekt elke regel in als levering en sluit de bestelling. Wat niet in `lines` zit, is niet geleverd
 * en komt (als het nog onder het minimum zit) gewoon terug op de bestellijst.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const r = parseReceive(await readJson(req));
    const db = supabase();

    // Eerst de bestelling sluiten, zodat twee mensen dezelfde levering niet dubbel inboeken.
    const { data: closed, error } = await db
      .from("orders")
      .update({ status: "ontvangen", closed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "open")
      .select("id,suppliers(name)")
      .maybeSingle();
    if (error) throw error;
    if (!closed) throw new InputError("Deze bestelling is al ontvangen of geannuleerd.");
    const supplier = (closed as { suppliers?: { name?: string } | null }).suppliers?.name ?? null;

    const who = whoFrom(req);
    const { data, error: insertError } = await db
      .from("batches")
      .insert(
        r.lines.map((l) => ({
          product_id: l.productId,
          area: l.area,
          qty: l.qty,
          remaining: l.qty,
          received: r.received,
          expires: l.expires,
          note: supplier ? `Bestelling ${supplier}` : "Bestelling",
          created_by: who,
        })),
      )
      .select(`${BATCH_COLS},products(name)`);
    if (insertError) {
      await db.from("orders").update({ status: "open", closed_at: null }).eq("id", id);
      throw insertError;
    }

    const rows = (data ?? []) as unknown as (Parameters<typeof toBatch>[0] & { products?: { name?: string } | null })[];
    await logActivity(db, req, {
      action: "order_receive",
      detail: `${supplier ?? "zonder leverancier"} · ${rows.length} ${rows.length === 1 ? "product" : "producten"}`,
    });
    await Promise.all(
      rows.map((row) => {
        const b = toBatch(row);
        return logActivity(db, req, {
          action: "add",
          productId: b.productId,
          productName: row.products?.name ?? null,
          qty: b.qty,
          detail: AREA_LABEL[b.area] + (b.expires ? ` · houdbaar tot ${b.expires}` : "") + (supplier ? ` · bestelling ${supplier}` : ""),
        });
      }),
    );
    return ok({ batches: rows.map(toBatch) }, 201);
  } catch (e) {
    return fail(e);
  }
}
