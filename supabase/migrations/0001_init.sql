-- Chạy file này trong Supabase Dashboard → SQL Editor.

create table if not exists public.products (
  code        text primary key,           -- Mã hàng
  barcode     text not null default '',   -- Mã vạch (có thể rỗng)
  name        text not null,
  price       numeric not null default 0,
  unit        text not null default '',
  updated_at  timestamptz not null default now()
);
create index if not exists products_barcode_idx on public.products (barcode);

create table if not exists public.label_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.label_items (
  list_id       uuid not null references public.label_lists (id) on delete cascade,
  product_code  text not null,
  barcode       text not null default '',
  name          text not null,
  price         numeric not null default 0,
  unit          text not null default '',
  added_at      timestamptz not null default now(),
  primary key (list_id, product_code)     -- chặn trùng trong cùng list
);

-- Chỉ người đã đăng nhập mới đọc/ghi được.
alter table public.products    enable row level security;
alter table public.label_lists enable row level security;
alter table public.label_items enable row level security;

drop policy if exists "auth full access" on public.products;
drop policy if exists "auth full access" on public.label_lists;
drop policy if exists "auth full access" on public.label_items;

create policy "auth full access" on public.products
  for all to authenticated using (true) with check (true);
create policy "auth full access" on public.label_lists
  for all to authenticated using (true) with check (true);
create policy "auth full access" on public.label_items
  for all to authenticated using (true) with check (true);

