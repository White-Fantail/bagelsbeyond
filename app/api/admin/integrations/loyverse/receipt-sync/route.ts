import { NextRequest, NextResponse } from "next/server";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { syncLoyverseReceipts } from "@/lib/integrations/services/loyverse-receipt-sync";

export async function POST(req: NextRequest) {
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
