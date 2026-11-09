-- Chạy câu lệnh này trong Supabase Dashboard → SQL Editor để:
-- 1. Cho phép bất kỳ ai (kể cả chưa đăng nhập Supabase Auth) đọc ghi products & label_lists
-- 2. Hỗ trợ đăng nhập tự do (không cần email format, không cần verify)

-- Cấp quyền truy cập cho role 'anon' và 'authenticated'
drop policy if exists "auth full access" on public.products;
drop policy if exists "auth full access" on public.label_lists;
drop policy if exists "auth full access" on public.label_items;
drop policy if exists "public full access" on public.products;
drop policy if exists "public full access" on public.label_lists;
drop policy if exists "public full access" on public.label_items;

create policy "public full access" on public.products
  for all to anon, authenticated using (true) with check (true);

create policy "public full access" on public.label_lists
  for all to anon, authenticated using (true) with check (true);

create policy "public full access" on public.label_items
  for all to anon, authenticated using (true) with check (true);

-- Cấp quyền truy cập cho bảng profiles
drop policy if exists "allow authenticated read profiles" on public.profiles;
drop policy if exists "public profiles access" on public.profiles;
create policy "public profiles access" on public.profiles
  for all to anon, authenticated using (true) with check (true);

