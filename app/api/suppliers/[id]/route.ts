import { supabase } from "@/lib/supabase";
import { SUPPLIER_COLS, fail, logActivity, ok, parseSupplier, readJson, supplierRow, toSupplier } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = supabase();
    const input = parseSupplier(await readJson(req));
    const { data, error } = await db.from("suppliers").update(supplierRow(input)).eq("id", id).select(SUPPLIER_COLS).single();
    if (error) throw error;
    const s = toSupplier(data);
    await logActivity(db, req, { action: "supplier_edit", detail: s.name });
    return ok(s);
  } catch (e) {
    return fail(e);
  }
}

/** Verwijdert de leverancier. Producten blijven bestaan, maar hebben dan geen leverancier meer. */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = supabase();
    const { data } = await db.from("suppliers").select("name").eq("id", id).maybeSingle();
    const { error } = await db.from("suppliers").delete().eq("id", id);
    if (error) throw error;
    await logActivity(db, req, { action: "supplier_delete", detail: (data as { name?: string } | null)?.name ?? null });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
