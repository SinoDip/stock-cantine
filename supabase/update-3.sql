-- Update 3: bestellingen (besteld → ontvangen) en stock tellen.
-- Voer dit bestand één keer uit in Supabase (SQL Editor → New query → Run), vóór je de nieuwe versie deployt.
-- Je bestaande stock blijft staan. Je kunt het veilig meer dan één keer uitvoeren.

-- Bestellingen: één rij per bestelling bij een leverancier.
create table if not exists public.orders (
  id           text primary key default gen_random_uuid()::text,
  supplier_id  text references public.suppliers(id) on delete set null,
  status       text not null default 'open' check (status in ('open', 'ontvangen', 'geannuleerd')),
  created_by   text,
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create index if not exists orders_open_idx on public.orders (status) where status = 'open';
alter table public.orders enable row level security;

-- Wat er besteld is: één rij per product in een bestelling.
create table if not exists public.order_lines (
  order_id    text not null references public.orders(id) on delete cascade,
  product_id  text not null references public.products(id) on delete cascade,
  qty         numeric not null check (qty > 0),
  primary key (order_id, product_id)
);
alter table public.order_lines enable row level security;

-- Telling: zet de stock van een product in één kant op het getelde aantal.
-- Minder dan gedacht: haalt weg bij de levering die het eerst vervalt (dan de oudste).
-- Meer dan gedacht: voegt een levering toe zonder vervaldatum.
-- Geeft terug hoeveel er vóór de telling was.
create or replace function public.set_count(p_product text, p_area text, p_qty numeric, p_who text default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  cur  numeric;
  diff numeric;
  b    public.batches%rowtype;
begin
  perform 1 from public.batches where product_id = p_product and area = p_area for update;
  select coalesce(sum(remaining), 0) into cur
    from public.batches where product_id = p_product and area = p_area and remaining > 0;

  if p_qty > cur then
    insert into public.batches (product_id, area, qty, remaining, received, note, created_by)
    values (p_product, p_area, p_qty - cur, p_qty - cur, current_date, 'Telling', p_who);
  elsif p_qty < cur then
    diff := cur - p_qty;
    for b in
      select * from public.batches
       where product_id = p_product and area = p_area and remaining > 0
       order by expires asc nulls last, received asc, created_at asc
    loop
      exit when diff <= 0;
      if b.remaining <= diff then
        delete from public.batches where id = b.id;
        diff := diff - b.remaining;
      else
        update public.batches set remaining = remaining - diff where id = b.id;
        diff := 0;
      end if;
    end loop;
  end if;

  return cur;
end;
$$;

revoke execute on function public.set_count(text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.set_count(text, text, numeric, text) to service_role;
