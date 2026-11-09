-- Chạy câu lệnh này trong Supabase Dashboard → SQL Editor để hỗ trợ đăng nhập bằng Số điện thoại:

-- 1. Thêm cột số điện thoại vào bảng profiles
alter table public.profiles add column if not exists phone text;
create unique index if not exists profiles_phone_idx on public.profiles (phone) where phone is not null;

-- 2. Hàm tra cứu email đăng nhập qua số điện thoại (chạy được cả khi chưa đăng nhập)
create or replace function public.get_login_email(identifier text)
returns text as $$
  select email from public.profiles
  where phone = identifier 
     or email = identifier 
     or phone = regexp_replace(identifier, '[^0-9]', '', 'g')
  limit 1;
$$ language sql security definer;

grant execute on function public.get_login_email(text) to anon, authenticated;

-- 3. HÀM TẠO / CẬP NHẬT TÀI KHOẢN NHANH QUA SQL:
-- Bạn có thể tạo tài khoản cho nhân viên trực tiếp bằng SQL:
-- Ví dụ tạo Admin bằng số điện thoại:
-- select public.create_staff_user('0912345678', 'matkhau123', 'admin');
--
-- Ví dụ tạo Nhân viên (staff):
-- select public.create_staff_user('0987654321', 'matkhau123', 'staff');
--
-- Hoặc tạo bằng Email:
-- select public.create_staff_user('admin@gmail.com', 'matkhau123', 'admin');

create or replace function public.create_staff_user(
  p_account text,             -- Số điện thoại (vd: 0912345678) hoặc Email
  p_password text,            -- Mật khẩu
  p_role text default 'staff' -- 'admin' hoặc 'staff'
)
returns text as $$
declare
  v_user_id uuid;
  v_email text;
  v_phone text;
begin
  if p_account like '%@%' then
    v_email := lower(trim(p_account));
    v_phone := null;
  else
    v_phone := regexp_replace(p_account, '[^0-9]', '', 'g');
    v_email := v_phone || '@anmart.vn';
  end if;

  -- Kiểm tra xem tài khoản đã tồn tại chưa
  select id into v_user_id from auth.users where email = v_email;
  
  if v_user_id is not null then
    -- Đã có tài khoản: cập nhật mật khẩu và role
    update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        raw_user_meta_data = jsonb_build_object('role', p_role, 'phone', v_phone),
        updated_at = now()
    where id = v_user_id;

    update public.profiles
    set role = p_role,
        phone = coalesce(v_phone, phone),
        email = v_email,
        updated_at = now()
    where id = v_user_id;

    return 'Đã cập nhật mật khẩu & quyền ' || upper(p_role) || ' cho tài khoản: ' || p_account;
  else
    -- Chưa có: tạo mới vào auth.users
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('role', p_role, 'phone', v_phone),
      now(),
      now()
    );

    insert into public.profiles (id, email, phone, role, updated_at)
    values (v_user_id, v_email, v_phone, p_role, now())
    on conflict (id) do update set
      role = p_role,
      phone = v_phone,
      email = v_email,
      updated_at = now();

    return 'Tạo thành công tài khoản ' || upper(p_role) || ': ' || p_account;
  end if;
end;
$$ language plpgsql security definer;
