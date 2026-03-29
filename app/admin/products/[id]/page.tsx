import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";
import ProductForm from "../ProductForm";
import DeleteProductButton from "./DeleteProductButton";
import OptionGroupManager from "./OptionGroupManager";
import { IntegrationSource } from "@/app/generated/prisma/enums";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const optionGroupSelect = {
    id: true,
    name: true,
    minSelect: true,
    maxSelect: true,
    isRequired: true,
    sortOrder: true,
    externalMapping: {
      select: { externalOptionGroupId: true },
    },
    options: {
      orderBy: { sortOrder: "asc" as const },
      select: {
        id: true,
        name: true,
        priceDelta: true,
        isActive: true,
        sortOrder: true,
        sku: true,
        tracksInventory: true,
      },
    },
  } as const;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      loyverseCategoryId: true,
      basePrice: true,
      isActive: true,
      isSubscriptionEligible: true,
      sortOrder: true,
      externalMappings: {
        where: { source: IntegrationSource.LOYVERSE },
        select: { id: true, externalProductId: true },
      },
      // Direct (primary) option groups
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        select: optionGroupSelect,
      },
      // Groups assigned via ProductOptionGroupAssignment
      optionGroupAssignments: {
        select: {
          optionGroup: { select: optionGroupSelect },
        },
      },
    },
  });

  if (!product) {
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
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-lg font-medium text-gray-700">Product not found</p>
          <p className="text-sm text-gray-400 mt-1">This product has been deleted or does not exist</p>
          <Link
            href="/admin/products"
            className="mt-4 inline-block px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const { optionGroups, optionGroupAssignments, externalMappings, ...productFields } = product;

  const isLoyverseSynced = externalMappings.length > 0;
  const externalProductId = externalMappings[0]?.externalProductId ?? null;

  const formProduct = {
    ...productFields,
    description: productFields.description ?? undefined,
    isLoyverseSynced,
    externalProductId,
  };

  // Combine direct groups and assignment groups, deduplicate by id
  const assignmentGroups = optionGroupAssignments.map((a) => a.optionGroup);
  const directGroupIds = new Set(optionGroups.map((g) => g.id));
  const allGroups = [
    ...optionGroups,
    ...assignmentGroups.filter((g) => !directGroupIds.has(g.id)),
  ].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko"));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
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
            <span className="text-gray-700 font-medium">{product.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Edit product information</p>
        </div>
        <DeleteProductButton productId={product.id} productName={product.name} />
      </div>

      <ProductForm product={formProduct} mode="edit" />

      <OptionGroupManager initialGroups={allGroups} />
    </div>
  );
}
