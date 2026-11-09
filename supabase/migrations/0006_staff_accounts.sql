-- Migration 0006: Hỗ trợ xác thực tài khoản dạng tự do (text, SĐT, email) + mật khẩu
-- Lưu trữ trực tiếp trong bảng public.staff_accounts (độc lập, không bị ràng buộc format email/sms của Supabase Auth)

create extension if not exists pgcrypto;

create table if not exists public.staff_accounts (
  username      text primary key,           -- Tên đăng nhập bất kỳ: 'admin', '0912345678', 'user1', v.v.
  password_hash text not null,              -- Mã hóa mật khẩu bằng bcrypt
  role          text not null default 'staff', -- 'admin' hoặc 'staff'
  display_name  text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Bật RLS
alter table public.staff_accounts enable row level security;

-- Cho phép đọc công khai hoặc dùng RPC
drop policy if exists "staff_accounts read" on public.staff_accounts;
create policy "staff_accounts read" on public.staff_accounts
  for select to anon, authenticated using (true);

-- Hàm tạo / cập nhật tài khoản (chạy trên SQL Editor hoặc gọi từ admin)
create or replace function public.upsert_staff_account(
  p_username text,
  p_password text,
  p_role text default 'staff',
  p_display_name text default ''
)
returns text as $$
declare
  v_user text := lower(trim(p_username));
begin
  if v_user = '' then
    raise exception 'Tên tài khoản không được để trống';
  end if;

  insert into public.staff_accounts (username, password_hash, role, display_name, updated_at)
  values (
    v_user,
    crypt(p_password, gen_salt('bf')),
    lower(p_role),
    coalesce(nullif(trim(p_display_name), ''), v_user),
    now()
  )
  on conflict (username) do update set
    password_hash = crypt(p_password, gen_salt('bf')),
    role = lower(p_role),
    display_name = coalesce(nullif(trim(p_display_name), ''), excluded.display_name),
    updated_at = now();

  return 'Thành công: ' || v_user || ' (' || upper(p_role) || ')';
end;
$$ language plpgsql security definer;

grant execute on function public.upsert_staff_account(text, text, text, text) to anon, authenticated;

-- Hàm đăng nhập kiểm tra tài khoản + mật khẩu (trả về role và username nếu đúng, null nếu sai)
create or replace function public.verify_staff_login(
  p_username text,
  p_password text
)
returns jsonb as $$
declare
  v_user text := lower(trim(p_username));
  r record;
begin
  select username, role, display_name, password_hash
  into r
  from public.staff_accounts
  where username = v_user;

  if not found then
    return null;
  end if;

  -- Kiểm tra mật khẩu qua bcrypt
  if r.password_hash = crypt(p_password, r.password_hash) then
    return jsonb_build_object(
      'username', r.username,
      'role', r.role,
      'display_name', r.display_name
    );
  end if;

  return null;
end;
$$ language plpgsql security definer;

grant execute on function public.verify_staff_login(text, text) to anon, authenticated;

-- Tạo sẵn 1 tài khoản Admin mặc định để bạn đăng nhập thử ngay:
-- Tài khoản: admin
-- Mật khẩu: 123456
select public.upsert_staff_account('admin', '123456', 'admin', 'Quản trị viên');

