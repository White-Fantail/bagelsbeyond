export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getMenuProductById } from "@/lib/services/menuProductService";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProductForm from "../../ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireAdmin();
  const { productId } = await params;

  const product = await getMenuProductById(productId);
  if (!product) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-amber-600 transition-colors">
            Products
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{product.name}</span>
          <span>/</span>
          <span className="text-gray-700 font-medium">Edit</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Update product details</p>
      </div>

      <ProductForm product={product} />
    </div>
  );
}
