export const dynamic = "force-dynamic";

import { requireStaffOrAdmin } from "@/lib/auth/dal";
import { listBagelTypesWithState } from "@/lib/services/bagel-availability-service";
import { BagelAvailabilityClient } from "./BagelAvailabilityClient";
import Link from "next/link";

export default async function BagelAvailabilityPage() {
  await requireStaffOrAdmin();
  const initialData = await listBagelTypesWithState();

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">Admin</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Bagel Availability</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Bagel Availability</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Turn bagel types ON/OFF and sync to Loyverse, Uber Eats, DoorDash.</p>
      </div>
      <BagelAvailabilityClient initialData={initialData} />
    </div>
  );
}
