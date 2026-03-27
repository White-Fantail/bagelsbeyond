import { requireAdmin } from "@/lib/auth/dal";
import Link from "next/link";
import ProductForm from "../ProductForm";

export default async function NewProductPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">
            Admin Dashboard
          </Link>
          <span>/</span>
          <Link href="/admin/products" className="hover:text-amber-600 transition-colors">
            Product Management
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Add New Product</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Enter new product information</p>
      </div>

      <ProductForm mode="create" />
    </div>
  );
}
