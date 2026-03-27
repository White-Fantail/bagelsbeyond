import SalesForm from "@/components/SalesForm";

export default function NewSalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enter Sales</h1>
        <p className="text-gray-500 mt-1">Enter daily sales data</p>
      </div>
      <SalesForm />
    </div>
  );
}
