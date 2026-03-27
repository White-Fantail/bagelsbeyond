"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { SubscriptionStatus } from "@/app/generated/prisma/enums";
import {
  createSubscription,
  updateSubscriptionStatus,
  skipOccurrence,
} from "@/lib/services/subscriptionService";

export interface SubscriptionActionState {
  success?: boolean;
  message?: string;
  subscriptionId?: string;
}

const createSubscriptionSchema = z.object({
  pickupWeekday: z.coerce.number().int().min(0).max(6),
  pickupTimeSlot: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(500).optional(),
  itemsJson: z.string().min(1),
});

export async function createSubscriptionAction(
  prevState: SubscriptionActionState,
  formData: FormData
): Promise<SubscriptionActionState> {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const parsed = createSubscriptionSchema.safeParse({
    pickupWeekday: formData.get("pickupWeekday"),
    pickupTimeSlot: formData.get("pickupTimeSlot") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    note: formData.get("note") || undefined,
    itemsJson: formData.get("itemsJson"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Input error" };
  }

  const { pickupWeekday, pickupTimeSlot, startDate, endDate, note, itemsJson } = parsed.data;

  let items: { productId: string; quantity: number }[];
  try {
    items = JSON.parse(itemsJson) as { productId: string; quantity: number }[];
  } catch {
    return { success: false, message: "Invalid product information" };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, message: "Please select at least 1 product" };
  }

  for (const item of items) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      return { success: false, message: "Invalid quantity" };
    }
  }

  try {
    const sub = await createSubscription({
      userId: session.userId,
      pickupWeekday,
      pickupTimeSlot,
      startDate: new Date(startDate + "T00:00:00.000Z"),
      endDate: endDate ? new Date(endDate + "T00:00:00.000Z") : undefined,
      note,
      items,
    });
    return { success: true, subscriptionId: sub.id };
  } catch (err) {
    console.error("Subscription creation failed:", err);
    return { success: false, message: "Error creating subscription" };
  }
}

export async function pauseSubscriptionAction(
  id: string
): Promise<SubscriptionActionState> {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  try {
    await updateSubscriptionStatus(id, SubscriptionStatus.PAUSED, session.userId);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "An error occurred" };
  }
}

export async function resumeSubscriptionAction(
  id: string
): Promise<SubscriptionActionState> {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  try {
    await updateSubscriptionStatus(id, SubscriptionStatus.ACTIVE, session.userId);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "An error occurred" };
  }
}

export async function cancelSubscriptionAction(
  id: string
): Promise<SubscriptionActionState> {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  try {
    await updateSubscriptionStatus(id, SubscriptionStatus.CANCELLED, session.userId);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "An error occurred" };
  }
}

export async function skipOccurrenceAction(
  occurrenceId: string
): Promise<SubscriptionActionState> {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  try {
    await skipOccurrence(occurrenceId, session.userId);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "An error occurred" };
  }
}
