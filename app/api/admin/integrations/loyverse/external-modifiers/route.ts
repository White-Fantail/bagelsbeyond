// GET /api/admin/integrations/loyverse/external-modifiers
// Fetches live modifier list from Loyverse (or mock data in dev mode).
// Used by the Modifier Mapping UI to populate the dropdown of available
// Loyverse modifier options to map internal ProductOptions against.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/dal";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();

  const adapter = createLoyverseAdapter();
  const modifiers = await adapter.fetchModifiers();

  // Return a flat list of { groupId, groupName, optionId, optionName, price }
  const flat = modifiers
    .filter((m) => m.deleted_at === null)
    .flatMap((m) =>
      m.options.map((o) => ({
        groupId: m.id,
        groupName: m.name,
        optionId: o.id,
        optionName: o.name,
        price: o.price,
      }))
    );

  return NextResponse.json({
    groups: modifiers
      .filter((m) => m.deleted_at === null)
      .map((m) => ({ id: m.id, name: m.name })),
    options: flat,
  });
}
