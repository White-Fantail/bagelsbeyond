import { getCustomerMenuItems } from "@/lib/customer/catalog";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getMinPickupDate, PICKUP_TIME_SLOTS } from "@/lib/order/pickup-slots";
import SubscriptionSignupClient from "./subscription-signup-client";

interface PageProps {
  params: Promise<{ planId: string }>;
}

export default async function SubscriptionPlanPage({ params }: PageProps) {
  const { planId } = await params;
  const items = await getCustomerMenuItems();
  const item = items.find(i => i.id === planId);
  if (!item) notFound();

  const session = await getSession();
  const minStartDate = getMinPickupDate();

  return (
    <SubscriptionSignupClient
      item={item}
      session={session ? { userId: session.userId, name: session.name } : null}
      minStartDate={minStartDate}
      pickupTimeSlots={PICKUP_TIME_SLOTS}
    />
  );
}
