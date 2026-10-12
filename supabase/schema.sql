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

-- Eén stuk gebruiken: trekt af van de levering die het eerst vervalt (dan de oudste).
-- Geeft de levering terug zoals ze was vóór de wijziging. Op 0 wordt de levering verwijderd.
create or replace function public.use_one(p_product text, p_amount numeric default 1)
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
  where product_id = p_product and remaining > 0
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
revoke execute on function public.use_one(text, numeric) from public, anon, authenticated;
revoke execute on function public.adjust_batch(text, numeric) from public, anon, authenticated;
grant execute on function public.use_one(text, numeric) to service_role;
grant execute on function public.adjust_batch(text, numeric) to service_role;
