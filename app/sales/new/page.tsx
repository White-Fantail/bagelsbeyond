import SalesForm from "@/components/SalesForm";

export default function NewSalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">새 매출 입력</h1>
        <p className="text-gray-500 mt-1">일별 매출 데이터를 입력합니다</p>
      </div>
      <SalesForm />
    </div>
  );
}
