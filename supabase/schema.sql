-- Stocklijst Cantine: tabellen en functies.
-- Plak dit in Supabase → SQL Editor → New query, en klik op Run.
-- Je kunt het veilig opnieuw uitvoeren.

-- Producten: één rij per product.
create table if not exists public.products (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  category    text not null default 'Overige',
  unit        text not null default 'stuks',
  min         numeric check (min >= 0),
  location    text,
  prep        boolean not null default false,
  shelf_days  integer check (shelf_days > 0),
  created_at  timestamptz not null default now()
);
create unique index if not exists products_name_unique on public.products (lower(name));

-- Leveringen (of prep-batches): één rij per levering, met wat er nog van over is.
create table if not exists public.batches (
  id          text primary key default gen_random_uuid()::text,
  product_id  text not null references public.products(id) on delete cascade,
  qty         numeric not null check (qty >= 0),
  remaining   numeric not null check (remaining >= 0),
  received    date not null default current_date,
  expires     date,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists batches_product_idx on public.batches (product_id);

-- Instellingen: precies één rij.
create table if not exists public.settings (
  id         integer primary key default 1 check (id = 1),
  warn_days  integer not null default 3 check (warn_days between 0 and 60)
);
insert into public.settings (id, warn_days) values (1, 3) on conflict (id) do nothing;

-- Beveiliging: zonder policies kan niemand met de publieke sleutel iets lezen of schrijven.
-- De app praat alleen via de server (service_role-sleutel), die hier niet door tegengehouden wordt.
alter table public.products enable row level security;
alter table public.batches  enable row level security;
alter table public.settings enable row level security;

-- Leveranciers.
create table if not exists public.suppliers (
  id               text primary key default gen_random_uuid()::text,
  name             text not null,
  contact          text,
  phone            text,
  email            text,
  customer_number  text,
  order_days       smallint[] not null default '{}',  -- 1 = maandag … 7 = zondag
  order_deadline   text,                              -- bv. '14:00'
  delivery_days    smallint[] not null default '{}',
  notes            text,
  created_at       timestamptz not null default now()
);
create unique index if not exists suppliers_name_unique on public.suppliers (lower(name));
alter table public.suppliers enable row level security;

-- Per product: leverancier, aankoopprijs per eenheid en allergenen.
alter table public.products add column if not exists supplier_id text references public.suppliers(id) on delete set null;
alter table public.products add column if not exists price numeric check (price >= 0);
alter table public.products add column if not exists allergens text[] not null default '{}';

-- Logboek: wie deed wat en wanneer.
create table if not exists public.activity_log (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  who           text,
  action        text not null,
  product_id    text,
  product_name  text,
  qty           numeric,
  detail        text
);
create index if not exists activity_log_created_idx on public.activity_log (created_at desc);
alter table public.activity_log enable row level security;

-- Keuken en Front: per product in welke kant(en), per levering in welke kant.
alter table public.products add column if not exists areas text[];
update public.products
   set areas = case when location = 'Bar' then array['front'] else array['keuken'] end
 where areas is null;
alter table public.products alter column areas set default array['keuken'];
alter table public.products alter column areas set not null;
alter table public.products drop constraint if exists products_areas_check;
alter table public.products add constraint products_areas_check
  check (cardinality(areas) >= 1 and areas <@ array['keuken', 'front']);

alter table public.batches add column if not exists area text;
update public.batches b
   set area = case when p.location = 'Bar' then 'front' else 'keuken' end
  from public.products p
 where p.id = b.product_id and b.area is null;
update public.batches set area = 'keuken' where area is null;
alter table public.batches alter column area set default 'keuken';
alter table public.batches alter column area set not null;
alter table public.batches drop constraint if exists batches_area_check;
alter table public.batches add constraint batches_area_check check (area in ('keuken', 'front'));

-- Eén stuk gebruiken: trekt af van de levering die het eerst vervalt (dan de oudste), in de gevraagde kant
-- (p_area null = maakt niet uit). Geeft de levering terug zoals ze was vóór de wijziging. Op 0 wordt de levering verwijderd.
drop function if exists public.use_one(text, numeric);
create or replace function public.use_one(p_product text, p_amount numeric default 1, p_area text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.batches%rowtype;
begin
  select * into b
  from public.batches
  where product_id = p_product and remaining > 0 and (p_area is null or area = p_area)
  order by expires asc nulls last, received asc, created_at asc
  limit 1
  for update;

  if not found then
    return null;
  end if;

  if b.remaining - p_amount <= 0 then
    delete from public.batches where id = b.id;
  else
    update public.batches set remaining = remaining - p_amount where id = b.id;
  end if;

  return row_to_json(b);
end;
$$;

-- Aantal van één levering aanpassen (+1 / −1). Op 0 wordt de levering verwijderd.
-- Geeft de levering terug na de wijziging.
create or replace function public.adjust_batch(p_id text, p_delta numeric)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.batches%rowtype;
begin
  update public.batches
     set remaining = greatest(remaining + p_delta, 0),
         qty       = greatest(qty, remaining + p_delta)
   where id = p_id
  returning * into b;

  if not found then
    return null;
  end if;

  if b.remaining <= 0 then
    delete from public.batches where id = p_id;
  end if;

  return row_to_json(b);
end;
$$;

-- Alleen de server mag deze functies aanroepen.
revoke execute on function public.use_one(text, numeric, text) from public, anon, authenticated;
revoke execute on function public.adjust_batch(text, numeric) from public, anon, authenticated;
grant execute on function public.use_one(text, numeric, text) to service_role;
grant execute on function public.adjust_batch(text, numeric) to service_role;

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
