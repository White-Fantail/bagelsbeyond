export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import { getMenuProductById } from "@/lib/services/menuProductService";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import ModifiersManager from "./ModifiersManager";

export default async function ModifiersPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireAdmin();
  const { productId } = await params;

  const [product, groups] = await Promise.all([
    getMenuProductById(productId),
    prisma.menuModifierGroup.findMany({
      where: { productId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        options: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
  ]);

  if (!product) notFound();

  const serializedGroups = groups.map((g) => ({
    ...g,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    options: g.options.map((o) => ({
      ...o,
      priceDelta: o.priceDelta.toNumber(),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
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
          <span className="text-gray-700 font-medium">Modifiers</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Modifier groups &amp; options</p>
        <div className="flex gap-3 mt-3">
          <Link
            href={`/products/${productId}/recipe`}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Recipe
          </Link>
          <span className="text-sm px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-700 font-medium">
            Modifiers
          </span>
        </div>
      </div>

      <ModifiersManager productId={productId} initialGroups={serializedGroups} />
    </div>
  );
}
