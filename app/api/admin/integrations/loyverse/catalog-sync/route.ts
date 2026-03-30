import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { syncLoyverseCatalog } from "@/lib/integrations/services/loyverse-catalog-sync";

export async function POST() {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const adapter = createLoyverseAdapter();
    const result = await syncLoyverseCatalog(adapter);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
