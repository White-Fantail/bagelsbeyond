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
            관리자 대시보드
          </Link>
          <span>/</span>
          <Link href="/admin/products" className="hover:text-amber-600 transition-colors">
            상품 관리
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">새 상품 추가</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">새 상품 추가</h1>
        <p className="text-gray-500 mt-0.5 text-sm">새로운 상품 정보를 입력하세요</p>
      </div>

      <ProductForm mode="create" />
    </div>
  );
}
