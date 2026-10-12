-- Update 1: leveranciers, prijzen, allergenen en logboek.
-- Heb je schema.sql al eerder uitgevoerd? Voer dan dit bestand één keer uit
-- (SQL Editor → New query → Run). Je bestaande stock blijft staan.
-- Begin je helemaal opnieuw? Dan zit dit al in schema.sql en heb je dit bestand niet nodig.
-- Je kunt het veilig meer dan één keer uitvoeren.

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
