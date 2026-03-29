// ─── Channel ID Resolver ──────────────────────────────────────────────────────
// Centralizes all external channel ID resolution for Beyond.
//
// RULE: Any code that communicates with an external channel API MUST resolve
//       the external ID through this service. NEVER pass a Beyond internal ID
//       directly to Loyverse, Uber Eats, DoorDash, or any other external API.
//
// Usage:
//   const externalId = await getMappedChannelProductId(productId, ChannelType.LOYVERSE);
//   if (!externalId) throw new Error("Product not mapped to Loyverse");
//   await loyverseApi.updateProduct(externalId, { ... });

import { prisma } from "@/lib/db";
import { ChannelType } from "@/app/generated/prisma/enums";

// ─── Type exports ────────────────────────────────────────────────────────────

export { ChannelType };

/**
 * Resolve the external channel product ID for a canonical product.
 * Returns null if no mapping exists for this product + channel combination.
 *
 * @param productId - The canonical Beyond product ID
 * @param channel   - The target external channel
 * @returns         - The external channel's product ID, or null if not mapped
 */
export async function getMappedChannelProductId(
  productId: string,
  channel: ChannelType
): Promise<string | null> {
  const mapping = await prisma.productChannelMapping.findUnique({
    where: { productId_channel: { productId, channel } },
    include: { channelProduct: { select: { externalId: true } } },
  });
  return mapping?.channelProduct.externalId ?? null;
}

/**
 * Resolve the external channel category ID for a canonical category.
 * Returns null if no mapping exists.
 */
export async function getMappedChannelCategoryId(
  categoryId: string,
  channel: ChannelType
): Promise<string | null> {
  const mapping = await prisma.categoryChannelMapping.findUnique({
    where: { categoryId_channel: { categoryId, channel } },
    include: { channelCategory: { select: { externalId: true } } },
  });
  return mapping?.channelCategory.externalId ?? null;
}

/**
 * Resolve the external channel modifier group ID for a canonical ProductOptionGroup.
 * Returns null if no mapping exists.
 */
export async function getMappedChannelModifierGroupId(
  modifierGroupId: string,
  channel: ChannelType
): Promise<string | null> {
  const mapping = await prisma.modifierGroupChannelMapping.findUnique({
    where: { modifierGroupId_channel: { modifierGroupId, channel } },
    include: { channelModifierGroup: { select: { externalId: true } } },
  });
  return mapping?.channelModifierGroup.externalId ?? null;
}

/**
 * Resolve the external channel modifier option ID for a canonical ProductOption.
 * Returns null if no mapping exists.
 */
export async function getMappedChannelModifierOptionId(
  modifierOptionId: string,
  channel: ChannelType
): Promise<string | null> {
  const mapping = await prisma.modifierOptionChannelMapping.findUnique({
    where: { modifierOptionId_channel: { modifierOptionId, channel } },
    include: { channelModifierOption: { select: { externalId: true } } },
  });
  return mapping?.channelModifierOption.externalId ?? null;
}

/**
 * Resolve the canonical product ID from an external channel product ID.
 * Used when receiving inbound data from a channel (e.g. order webhooks).
 * Returns null if no canonical mapping exists.
 */
export async function getCanonicalProductIdFromChannel(
  externalProductId: string,
  channel: ChannelType
): Promise<string | null> {
  const channelProduct = await prisma.channelProduct.findUnique({
    where: { channel_externalId: { channel, externalId: externalProductId } },
    include: {
      channelMapping: { select: { productId: true } },
    },
  });
  return channelProduct?.channelMapping?.productId ?? null;
}

/**
 * Resolve the canonical category ID from an external channel category ID.
 * Returns null if no canonical mapping exists.
 */
export async function getCanonicalCategoryIdFromChannel(
  externalCategoryId: string,
  channel: ChannelType
): Promise<string | null> {
  const channelCategory = await prisma.channelCategory.findUnique({
    where: { channel_externalId: { channel, externalId: externalCategoryId } },
    include: {
      channelMapping: { select: { categoryId: true } },
    },
  });
  return channelCategory?.channelMapping?.categoryId ?? null;
}

/**
 * Resolve the canonical modifier group ID from an external channel modifier group ID.
 * Returns null if no canonical mapping exists.
 */
export async function getCanonicalModifierGroupIdFromChannel(
  externalModifierGroupId: string,
  channel: ChannelType
): Promise<string | null> {
  const channelGroup = await prisma.channelModifierGroup.findUnique({
    where: { channel_externalId: { channel, externalId: externalModifierGroupId } },
    include: {
      channelMapping: { select: { modifierGroupId: true } },
    },
  });
  return channelGroup?.channelMapping?.modifierGroupId ?? null;
}

/**
 * Resolve the canonical modifier option ID from an external channel modifier option ID.
 * Returns null if no canonical mapping exists.
 */
export async function getCanonicalModifierOptionIdFromChannel(
  externalModifierOptionId: string,
  channel: ChannelType
): Promise<string | null> {
  const channelOption = await prisma.channelModifierOption.findUnique({
    where: { channel_externalId: { channel, externalId: externalModifierOptionId } },
    include: {
      channelMapping: { select: { modifierOptionId: true } },
    },
  });
  return channelOption?.channelMapping?.modifierOptionId ?? null;
}

/**
 * Batch-resolve external channel product IDs for a list of canonical product IDs.
 * Returns a map of productId → externalId (omits unmapped products).
 */
export async function batchGetMappedChannelProductIds(
  productIds: string[],
  channel: ChannelType
): Promise<Map<string, string>> {
  const mappings = await prisma.productChannelMapping.findMany({
    where: { productId: { in: productIds }, channel },
    include: { channelProduct: { select: { externalId: true } } },
  });

  const result = new Map<string, string>();
  for (const m of mappings) {
    result.set(m.productId, m.channelProduct.externalId);
  }
  return result;
}
