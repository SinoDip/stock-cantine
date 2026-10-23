import { supabase } from "@/lib/supabase";
import { InputError, fail, logActivity, ok } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

/** Bestelling annuleren: de producten komen terug op de bestellijst. */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = supabase();
    const { data, error } = await db
      .from("orders")
      .update({ status: "geannuleerd", closed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "open")
      .select("id,suppliers(name)")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new InputError("Deze bestelling is al ontvangen of geannuleerd.");
    const name = (data as { suppliers?: { name?: string } | null }).suppliers?.name;
    await logActivity(db, req, { action: "order_cancel", detail: name ?? "zonder leverancier" });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
