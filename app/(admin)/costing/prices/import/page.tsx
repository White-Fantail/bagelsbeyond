export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/dal";
import Link from "next/link";
import PriceImportClient from "./PriceImportClient";

export default async function PriceImportPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-amber-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/ingredients" className="hover:text-amber-600 transition-colors">Ingredients</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">CSV Price Import</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">CSV Price Import</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Import ingredient prices from a CSV file. Preview before applying.
        </p>
      </div>
      <PriceImportClient />
    </div>
  );
}
