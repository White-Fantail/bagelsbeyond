import Link from "next/link";

export default function IntegrationsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Integrations</h1>
      <div className="flex flex-col gap-4">
        <Link href="/admin/integrations/loyverse" className="border rounded p-4 hover:bg-gray-50">
          <h2 className="font-semibold">Loyverse POS</h2>
          <p className="text-sm text-gray-500">Sync catalog and receipts from Loyverse</p>
        </Link>
      </div>
    </div>
  );
}
