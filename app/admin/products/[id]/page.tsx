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
        externalOptionMappings: {
          where: { source: IntegrationSource.LOYVERSE },
          select: {
            id: true,
            externalOptionId: true,
            externalName: true,
          },
        },
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

  // Fetch Loyverse modifier groups linked to this item
  let loyverseModifierGroups: {
    id: string;
    name: string;
    required: boolean;
    minSelect: number | null;
    maxSelect: number | null;
    options: { id: string; name: string; price: number }[];
  }[] = [];

  if (externalProductId) {
    const loyverseItem = await prisma.loyverseItem.findUnique({
      where: { id: externalProductId },
      select: {
        modifiers: {
          select: {
            modifier: {
              select: {
                id: true,
                name: true,
                required: true,
                minSelect: true,
                maxSelect: true,
                options: {
                  select: { id: true, name: true, price: true },
                  orderBy: { name: "asc" },
                },
              },
            },
          },
        },
      },
    });
    if (loyverseItem) {
      loyverseModifierGroups = loyverseItem.modifiers.map((m) => m.modifier);
    }
  }

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

  // Count modifier mapping status
  const allOptions = allGroups.flatMap((g) => g.options);
  const mappedCount = allOptions.filter((o) => o.externalOptionMappings.length > 0).length;
  const unmappedActiveCount = allOptions.filter(
    (o) => o.isActive && o.externalOptionMappings.length === 0
  ).length;

  // Debug: check consistency between internal DB links and Loyverse mirror links
  const internalGroupNames = new Set(allGroups.map((g) => g.name));
  const mirrorGroupNames = new Set(loyverseModifierGroups.map((g) => g.name));
  const internalOnlyGroups = allGroups.filter((g) => !mirrorGroupNames.has(g.name));
  const mirrorOnlyGroups = loyverseModifierGroups.filter((g) => !internalGroupNames.has(g.name));
  const isConsistent =
    !isLoyverseSynced ||
    (internalOnlyGroups.length === 0 && mirrorOnlyGroups.length === 0);

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

      <OptionGroupManager productId={product.id} initialGroups={allGroups} />

      {/* Loyverse Modifier Sync Debug Panel */}
      {isLoyverseSynced && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Loyverse Modifier Sync Status</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Compares internal DB linked groups with Loyverse mirror data.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono">{externalProductId}</span>
              {isConsistent ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  ✓ Consistent
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  ⚠ Out of sync — run Full Sync
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {/* Internal DB links */}
            <div className="rounded-lg border border-gray-100 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Internal DB ({allGroups.filter((g) => g.externalMapping != null).length} Loyverse-synced)
              </p>
              {allGroups.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No linked modifier groups</p>
              ) : (
                allGroups.map((g) => (
                  <div key={g.id} className="flex items-center gap-1.5">
                    {g.externalMapping ? (
                      <span className="text-blue-500 text-xs">🔗</span>
                    ) : (
                      <span className="text-gray-300 text-xs">○</span>
                    )}
                    <span className={g.externalMapping ? "text-gray-800" : "text-gray-500"}>
                      {g.name}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Loyverse mirror links */}
            <div className="rounded-lg border border-gray-100 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Loyverse Mirror ({loyverseModifierGroups.length})
              </p>
              {loyverseModifierGroups.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No modifier groups linked in Loyverse
                </p>
              ) : (
                loyverseModifierGroups.map((group) => (
                  <div key={group.id} className="flex items-center gap-1.5">
                    <span className="text-blue-500 text-xs">🔗</span>
                    <span className="text-gray-800">{group.name}</span>
                    {group.required && (
                      <span className="text-amber-600 text-xs">* Required</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Show discrepancies if any */}
          {!isConsistent && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-800">Discrepancies detected</p>
              {mirrorOnlyGroups.length > 0 && (
                <p className="text-xs text-amber-700">
                  In Loyverse but not in internal DB:{" "}
                  {mirrorOnlyGroups.map((g) => g.name).join(", ")}
                </p>
              )}
              {internalOnlyGroups.filter((g) => g.externalMapping != null).length > 0 && (
                <p className="text-xs text-amber-700">
                  Loyverse-synced in internal DB but not in mirror:{" "}
                  {internalOnlyGroups
                    .filter((g) => g.externalMapping != null)
                    .map((g) => g.name)
                    .join(", ")}
                </p>
              )}
              <p className="text-xs text-amber-600 mt-1">
                Run a Full Sync from the{" "}
                <Link href="/admin/integrations/loyverse" className="underline">
                  Loyverse integration page
                </Link>{" "}
                to resolve.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modifier Mapping Status */}
      {allOptions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Loyverse Modifier Mapping Status</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Bagel types (Bagel Type) are managed by modifier, not variant.
                All options must be mapped before sending orders.
              </p>
            </div>
            <Link
              href="/admin/integrations/loyverse/modifiers"
              className="shrink-0 px-3 py-1.5 rounded-lg text-sm bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              Manage Mapping →
            </Link>
          </div>

          <div className="flex gap-4 text-sm">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              ✓ Mapped {mappedCount}
            </span>
            {unmappedActiveCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                ✗ Unmapped (Active) {unmappedActiveCount}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                No unmapped
              </span>
            )}
          </div>

          {allGroups.map((group) => (
            <div key={group.id} className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 text-xs font-semibold text-gray-600">
                {group.name}
                {group.isRequired && (
                  <span className="ml-2 text-amber-600">* Required</span>
                )}
              </div>
              <ul className="divide-y divide-gray-100">
                {group.options.map((opt) => {
                  const mapping = opt.externalOptionMappings[0];
                  return (
                    <li key={opt.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={opt.isActive ? "text-gray-800" : "text-gray-400 line-through"}>
                          {opt.name}
                        </span>
                        {opt.tracksInventory && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                            Inventory Tracking
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {mapping ? (
                          <>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              ✓ Mapped
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              {mapping.externalName ?? mapping.externalOptionId}
                            </span>
                          </>
                        ) : opt.isActive ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                            ✗ Unmapped
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                            Inactive
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
