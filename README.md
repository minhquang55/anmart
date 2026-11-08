# AnMart

AnMart là một ứng dụng quản lý kho mini Mart được xây dựng với Next.js. Ứng dụng giúp các cửa hàng nhỏ theo dõi tồn kho, cập nhật sản phẩm và quản lý doanh thu một cách hiệu quả.

## 🚀 Tính năng chính

- **Quản lý danh mục (Categories):** Dễ dàng thêm, sửa, xóa và quản lý các danh mục sản phẩm.
- **Quản lý sản phẩm (Products):**
  - Thêm sản phẩm với tên, mã vạch (barcode), giá vốn, giá bán, số lượng tồn kho.
  - Cập nhật thông tin sản phẩm.
  - Tìm kiếm sản phẩm nhanh chóng.
- **Quản lý nhãn (Labels):**
  - Tạo và quản lý các nhãn riêng.
  - Dễ dàng thêm sản phẩm vào nhãn và ngược lại.
  - In nhãn với kích thước phù hợp cho máy in nhiệt.
- **Dashboard:** Tổng quan về số lượng danh mục và sản phẩm.
- **Giao diện:** Thiết kế hiện đại, thân thiện với người dùng, tối ưu cho mobile và desktop.

## 🛠 Công nghệ sử dụng

- **Frontend:** [Next.js 14](https://nextjs.org/) (App Router, Server Components)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL, Auth)
- **Icons:** [Lucide React](https://lucide.dev/)

## 🏁 Hướng dẫn cài đặt và chạy

### Điều kiện tiên quyết

- **Node.js:** 18.x trở lên
- **npm / yarn / pnpm / bun**

### Cài đặt

1. Clone repository:

   ```bash
   git clone <repository-url>
   cd anmart
   ```

2. Cài đặt dependencies:

   ```bash
   pnpm install
   # hoặc
   npm install
   # hoặc
   yarn install
   ```

3. Cấu hình biến môi trường:
   - Tạo file `.env.local` trong thư mục gốc:

     ```bash
     cp .env.example .env.local
     ```
   - Cập nhật các biến môi trường sau với thông tin Supabase của bạn:

     ```bash
     NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
     ```

4. Tạo database và tables (nếu chưa có):
   - Kết nối đến database Supabase của bạn.
   - Chạy các script SQL trong file `database/schema.sql` để tạo các bảng cần thiết.

5. Chạy development server:

   ```bash
   pnpm dev
   # hoặc
   npm run dev
   # hoặc
   yarn dev
   ```

6. Mở ứng dụng:
   - Truy cập [http://localhost:3000](http://localhost:3000) trong trình duyệt.

### Commands hữu ích

- **Development server:**
  ```bash
  pnpm dev
  ```

- **Build production:**
  ```bash
  pnpm build
  ```

- **Run production server:**
  ```bash
  pnpm start
  ```

- **Lint code:**
  ```bash
  pnpm lint
  ```

## 📄 Giấy phép

MIT


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
