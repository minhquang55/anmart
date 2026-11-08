import CashCounter from "@/components/CashCounter";
import { PageHeader } from "@/components/ui";

export default function CashCountPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Đếm tiền" subtitle="Nhập số tờ theo mệnh giá, tự ra tổng tiền" />
      <CashCounter />
    </div>
  );
}

