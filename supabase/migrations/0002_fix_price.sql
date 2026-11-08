-- Chạy câu lệnh này nếu bảng products trên Supabase đang báo lỗi NOT NULL:
alter table public.products alter column price drop not null;
alter table public.products alter column price set default 0;

