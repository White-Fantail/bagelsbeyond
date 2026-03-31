import CheckoutClient from "./checkout-client";
import { getSession } from "@/lib/auth/session";
import { getMinPickupDate, PICKUP_TIME_SLOTS } from "@/lib/order/pickup-slots";

export default async function CheckoutPage() {
  const session = await getSession();
  const minPickupDate = getMinPickupDate();
  return (
    <CheckoutClient
      session={session ? { userId: session.userId, name: session.name, email: session.email } : null}
      minPickupDate={minPickupDate}
      pickupTimeSlots={PICKUP_TIME_SLOTS}
    />
  );
}
