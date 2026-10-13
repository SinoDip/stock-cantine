-- Update 2: aparte stock voor Keuken en Front.
-- Voer dit bestand één keer uit in Supabase (SQL Editor → New query → Run), vóór je de nieuwe versie deployt.
-- Je bestaande stock blijft staan: producten met locatie "Bar" gaan naar Front, de rest naar Keuken.
-- Je kunt het veilig meer dan één keer uitvoeren.

-- Per product: in welke kant(en) het gebruikt wordt.
alter table public.products add column if not exists areas text[];
update public.products
   set areas = case when location = 'Bar' then array['front'] else array['keuken'] end
 where areas is null;
alter table public.products alter column areas set default array['keuken'];
alter table public.products alter column areas set not null;
alter table public.products drop constraint if exists products_areas_check;
alter table public.products add constraint products_areas_check
  check (cardinality(areas) >= 1 and areas <@ array['keuken', 'front']);

-- Per levering: in welke kant ze staat.
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

-- Eén stuk gebruiken, nu per kant (p_area null = maakt niet uit).
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

revoke execute on function public.use_one(text, numeric, text) from public, anon, authenticated;
grant execute on function public.use_one(text, numeric, text) to service_role;
