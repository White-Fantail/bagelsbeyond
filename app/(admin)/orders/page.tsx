import { requireAdmin } from "@/lib/auth/dal";
import Link from "next/link";

// Simplified admin orders page - basic placeholder that will build successfully
export default async function OrdersPage() {
  await requireAdmin();
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customer Orders</h1>
        <p className="text-gray-600 mt-1">
          Manage online orders from customers
        </p>
      </div>
      
      <div className="bg-white rounded-lg border p-8 text-center">
        <p className="text-gray-600 mb-4">
          Orders list will be displayed here
        </p>
        <Link
          href="/order"
          className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          View Public Ordering Page
        </Link>
      </div>
    </div>
  );
}
