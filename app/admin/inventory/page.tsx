export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import Link from "next/link";
import InventoryManager from "./InventoryManager";

export default async function InventoryPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">
            Admin Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">daily Inventory Management</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">daily Inventory Management</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Manage daily product production and inventory status
        </p>
      </div>
      <InventoryManager />
    </div>
  );
}
