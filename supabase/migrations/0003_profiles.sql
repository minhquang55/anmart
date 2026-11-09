-- Chạy câu lệnh này trong Supabase Dashboard → SQL Editor để kích hoạt phân quyền Admin / Staff:

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  role        text not null default 'staff', -- 'admin' hoặc 'staff'
  updated_at  timestamptz not null default now()
);

-- Bật RLS: Cho phép user đã đăng nhập đọc danh sách profile
alter table public.profiles enable row level security;

drop policy if exists "allow authenticated read profiles" on public.profiles;
create policy "allow authenticated read profiles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "allow users insert own profile" on public.profiles;
create policy "allow users insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Tự động sync tất cả user hiện có vào bảng profiles
insert into public.profiles (id, email, role)
select id, email, coalesce(raw_user_meta_data->>'role', 'staff')
from auth.users
on conflict (id) do nothing;

-- LỆNH GÁN QUYỀN ADMIN:
-- Thay 'email-cua-ban@gmail.com' bằng email bạn đã đăng ký để nâng lên Admin:
-- update public.profiles set role = 'admin' where email = 'email-cua-ban@gmail.com';

