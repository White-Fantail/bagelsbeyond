import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";
import ProductForm from "../ProductForm";
import DeleteProductButton from "./DeleteProductButton";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: true,
      basePrice: true,
      isActive: true,
      isSubscriptionEligible: true,
      sortOrder: true,
    },
  });

  if (!product) {
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
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-lg font-medium text-gray-700">상품을 찾을 수 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">삭제되었거나 존재하지 않는 상품입니다</p>
          <Link
            href="/admin/products"
            className="mt-4 inline-block px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            상품 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const formProduct = {
    ...product,
    description: product.description ?? undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
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
            <span className="text-gray-700 font-medium">{product.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">상품 수정</h1>
          <p className="text-gray-500 mt-0.5 text-sm">상품 정보를 수정합니다</p>
        </div>
        <DeleteProductButton productId={product.id} productName={product.name} />
      </div>

      <ProductForm product={formProduct} mode="edit" />
    </div>
  );
}
