export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getIngredientById } from "@/lib/services/ingredientService";
import { listSuppliers } from "@/lib/services/supplierService";
import Link from "next/link";
import { notFound } from "next/navigation";
import IngredientSupplierLinkForm from "../IngredientSupplierLinkForm";

export default async function NewIngredientSupplierLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [ingredient, suppliers] = await Promise.all([
    getIngredientById(id),
    listSuppliers(),
  ]);

  if (!ingredient) notFound();

  return (
    <div className="space-y-6 w-full">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/ingredients" className="hover:text-amber-600 transition-colors">
            Ingredients
          </Link>
          <span>/</span>
          <Link
            href={`/ingredients/${id}/suppliers`}
            className="hover:text-amber-600 transition-colors"
          >
            {ingredient.name}
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Add Supplier Link</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Add Supplier Link</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Link a supplier to {ingredient.name}
        </p>
      </div>

      <IngredientSupplierLinkForm ingredientId={id} suppliers={suppliers} />
    </div>
  );
}
