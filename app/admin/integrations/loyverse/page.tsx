import { prisma } from "@/lib/db";
import LoyverseSyncButton from "./LoyverseSyncButton";

export default async function LoyversePage() {
  const lastSync = await prisma.syncJob.findFirst({
    where: { channel: "LOYVERSE" },
    orderBy: { startedAt: "desc" },
  });

  const counts = await Promise.all([
    prisma.channelCategory.count({ where: { channel: "LOYVERSE" } }),
    prisma.channelItem.count({ where: { channel: "LOYVERSE" } }),
    prisma.channelVariant.count({ where: { channel: "LOYVERSE" } }),
    prisma.channelModifierGroup.count({ where: { channel: "LOYVERSE" } }),
    prisma.channelModifierOption.count({ where: { channel: "LOYVERSE" } }),
    prisma.channelPaymentType.count({ where: { channel: "LOYVERSE" } }),
    prisma.channelReceipt.count({ where: { channel: "LOYVERSE" } }),
  ]);

  const [categories, items, variants, modifierGroups, modifierOptions, paymentTypes, receipts] = counts;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Loyverse Integration</h1>
      {lastSync && (
        <p className="text-sm text-gray-500 mb-4">
          Last sync: {lastSync.startedAt.toISOString()} — {lastSync.status}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Categories", categories],
          ["Items", items],
          ["Variants", variants],
          ["Modifier Groups", modifierGroups],
          ["Modifier Options", modifierOptions],
          ["Payment Types", paymentTypes],
          ["Receipts", receipts],
        ].map(([label, count]) => (
          <div key={String(label)} className="border rounded p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>
      <LoyverseSyncButton />
    </div>
  );
}
