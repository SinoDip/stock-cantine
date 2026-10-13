import { supabase } from "@/lib/supabase";
import { AREA_LABEL, isArea } from "@/lib/stock";
import { BATCH_COLS, InputError, fail, logActivity, ok, optDate, optNum, productName, readJson, toBatch } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

async function batchInfo(db: ReturnType<typeof supabase>, id: string) {
  const { data } = await db.from("batches").select("product_id,remaining,area").eq("id", id).maybeSingle();
  const row = data as { product_id: string; remaining: number | string; area: string | null } | null;
  if (!row) return null;
  return { productId: row.product_id, remaining: Number(row.remaining), area: isArea(row.area) ? row.area : "keuken", name: await productName(db, row.product_id) };
}

/**
 * Aanpassen van één levering:
 *  - { delta: -1 }        aantal omhoog/omlaag (atomair in de database; op 0 wordt de rij verwijderd)
 *  - { expires: "..." }   vervaldatum wijzigen (null = geen datum)
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await readJson(req);
    const db = supabase();
    if ("delta" in body) {
      const delta = Number(body.delta);
      if (!Number.isFinite(delta) || delta === 0) throw new InputError("Ongeldige wijziging.");
      const { data, error } = await db.rpc("adjust_batch", { p_id: id, p_delta: delta });
      if (error) throw error;
      const batch = data ? toBatch(data) : null;
      if (batch) {
        await logActivity(db, req, {
          action: delta < 0 ? "use" : "adjust",
          productId: batch.productId,
          productName: await productName(db, batch.productId),
          qty: delta,
          detail: AREA_LABEL[batch.area],
        });
      }
      return ok({ batch });
    }
    if ("expires" in body) {
      const expires = optDate(body.expires);
      const { data, error } = await db.from("batches").update({ expires }).eq("id", id).select(BATCH_COLS).single();
      if (error) throw error;
      const batch = toBatch(data);
      await logActivity(db, req, {
        action: "expiry",
        productId: batch.productId,
        productName: await productName(db, batch.productId),
        detail: `${AREA_LABEL[batch.area]} · ${expires ? `nieuwe vervaldatum ${expires}` : "vervaldatum gewist"}`,
      });
      return ok({ batch });
    }
    throw new InputError("Niets om aan te passen.");
  } catch (e) {
    return fail(e);
  }
}

/** Levering terugzetten zoals ze was (voor "Ongedaan maken"). */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = supabase();
    const b = await readJson(req);
    const remaining = optNum(b.remaining) ?? 0;
    const qty = Math.max(optNum(b.qty) ?? remaining, remaining);
    if (typeof b.productId !== "string") throw new InputError("Product ontbreekt.");
    const { data, error } = await db
      .from("batches")
      .upsert({
        id,
        product_id: b.productId,
        area: isArea(b.area) ? b.area : "keuken",
        qty,
        remaining,
        received: optDate(b.received) ?? new Date().toISOString().slice(0, 10),
        expires: optDate(b.expires),
        note: typeof b.note === "string" ? b.note : null,
        created_by: typeof b.createdBy === "string" ? b.createdBy : null,
        ...(typeof b.createdAt === "string" ? { created_at: b.createdAt } : {}),
      })
      .select(BATCH_COLS)
      .single();
    if (error) throw error;
    await logActivity(db, req, {
      action: "restore",
      productId: b.productId,
      productName: await productName(db, b.productId),
      qty: remaining,
      detail: `${AREA_LABEL[isArea(b.area) ? b.area : "keuken"]} · ongedaan gemaakt`,
    });
    return ok({ batch: toBatch(data) });
  } catch (e) {
    return fail(e);
  }
}

/** Levering verwijderen. ?reden=weggegooid zet het als "weggegooid" in het logboek. */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = supabase();
    const info = await batchInfo(db, id);
    const { error } = await db.from("batches").delete().eq("id", id);
    if (error) throw error;
    if (info) {
      const discarded = new URL(req.url).searchParams.get("reden") === "weggegooid";
      await logActivity(db, req, {
        action: discarded ? "discard" : "remove",
        productId: info.productId,
        productName: info.name,
        qty: info.remaining,
        detail: AREA_LABEL[info.area],
      });
    }
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
