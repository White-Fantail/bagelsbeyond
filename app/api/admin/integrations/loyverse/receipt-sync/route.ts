import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { syncLoyverseReceipts } from "@/lib/integrations/services/loyverse-receipt-sync";

export async function POST(req: NextRequest) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const adapter = createLoyverseAdapter();
    const result = await syncLoyverseReceipts(adapter, {
      after: body.after,
      before: body.before,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
