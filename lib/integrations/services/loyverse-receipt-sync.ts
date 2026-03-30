/**
 * Loyverse Receipt Mirror Sync
 *
 * Populates channel_receipts and nested receipt tables from the Loyverse API.
 * Receipt mirror tables do NOT reference internal product IDs.
 */

import { prisma } from "@/lib/db";
import { Channel } from "@/app/generated/prisma/enums";
import type { LoyverseAdapter } from "../adapters/pos/loyverse";

export interface ReceiptSyncResult {
  status: "success" | "partial" | "failed";
  startedAt: Date;
  finishedAt: Date;
  receiptsSynced: number;
  errors: string[];
}

export async function syncLoyverseReceipts(
  adapter: LoyverseAdapter,
  options: { after?: string; before?: string } = {}
): Promise<ReceiptSyncResult> {
  const startedAt = new Date();
  const errors: string[] = [];
  let receiptsSynced = 0;

  const syncJob = await prisma.syncJob.create({
    data: { channel: Channel.LOYVERSE, syncType: "RECEIPT_PULL", status: "RUNNING" },
  });

  try {
    const receiptsResult = await adapter.fetchRawReceipts(options);
    if (!receiptsResult.success || !receiptsResult.data) {
      throw new Error(receiptsResult.error ?? "Failed to fetch receipts");
    }

    for (const receipt of receiptsResult.data) {
      const channelReceipt = await prisma.channelReceipt.upsert({
        where: {
          channel_externalId: { channel: Channel.LOYVERSE, externalId: receipt.id ?? "" },
        },
        create: {
          channel: Channel.LOYVERSE,
          externalId: receipt.id ?? null,
          storeExternalId: receipt.store_id ?? null,
          orderCode: receipt.receipt_number ?? null,
          customerExternalId: receipt.customer_id ?? null,
          source: receipt.source ?? null,
          receiptDate: receipt.receipt_date ? new Date(receipt.receipt_date) : null,
          note: receipt.note ?? null,
          rawPayload: receipt as object,
          syncedAt: new Date(),
        },
        update: {
          storeExternalId: receipt.store_id ?? null,
          receiptDate: receipt.receipt_date ? new Date(receipt.receipt_date) : null,
          note: receipt.note ?? null,
          rawPayload: receipt as object,
          syncedAt: new Date(),
        },
      });

      for (const lineItem of receipt.line_items ?? []) {
        let channelVariantId: string | null = null;
        if (lineItem.variant_id) {
          const cv = await prisma.channelVariant.findUnique({
            where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: lineItem.variant_id } },
          });
          channelVariantId = cv?.id ?? null;
        }

        const channelLineItem = await prisma.channelReceiptLineItem.create({
          data: {
            channel: Channel.LOYVERSE,
            channelReceiptId: channelReceipt.id,
            channelVariantExternalId: lineItem.variant_id ?? null,
            channelVariantId,
            quantity: lineItem.quantity ?? 1,
            price: lineItem.price ?? null,
            cost: lineItem.cost ?? null,
            lineNote: lineItem.note ?? null,
            rawPayload: lineItem as object,
          },
        });

        for (const mod of lineItem.modifiers ?? []) {
          let channelModifierOptionId: string | null = null;
          if (mod.modifier_option_id) {
            const cmo = await prisma.channelModifierOption.findUnique({
              where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: mod.modifier_option_id } },
            });
            channelModifierOptionId = cmo?.id ?? null;
          }
          await prisma.channelReceiptLineItemModifier.create({
            data: {
              channel: Channel.LOYVERSE,
              channelReceiptLineItemId: channelLineItem.id,
              channelModifierOptionExternalId: mod.modifier_option_id ?? null,
              channelModifierOptionId,
              price: mod.price ?? null,
              rawPayload: mod as object,
            },
          });
        }
      }

      for (const payment of receipt.payments ?? []) {
        let channelPaymentTypeId: string | null = null;
        if (payment.payment_type_id) {
          const cpt = await prisma.channelPaymentType.findUnique({
            where: { channel_externalId: { channel: Channel.LOYVERSE, externalId: payment.payment_type_id } },
          });
          channelPaymentTypeId = cpt?.id ?? null;
        }
        await prisma.channelReceiptPayment.create({
          data: {
            channel: Channel.LOYVERSE,
            channelReceiptId: channelReceipt.id,
            channelPaymentTypeExternalId: payment.payment_type_id ?? null,
            channelPaymentTypeId,
            paidAt: payment.paid_at ? new Date(payment.paid_at) : null,
            amount: payment.money_amount ?? null,
            rawPayload: payment as object,
          },
        });
      }

      receiptsSynced++;
    }

    const finishedAt = new Date();
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { status: errors.length > 0 ? "PARTIAL" : "SUCCESS", finishedAt, summary: { receiptsSynced, errors } },
    });
    return { status: errors.length > 0 ? "partial" : "success", startedAt, finishedAt, receiptsSynced, errors };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push(errorMessage);
    const finishedAt = new Date();
    await prisma.syncJob.update({ where: { id: syncJob.id }, data: { status: "FAILED", finishedAt, errorMessage } });
    return { status: "failed", startedAt, finishedAt, receiptsSynced, errors };
  }
}
