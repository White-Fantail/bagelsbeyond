export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import CheckoutForm from "./CheckoutForm";

export default async function CheckoutPage() {
  const session = await requireAuth();

  const profile = await prisma.customerProfile.findUnique({
    where: { userId: session.userId },
    select: { phone: true },
  });

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">결제하기</h1>
        <p className="text-gray-500 text-sm mt-1">픽업 날짜와 시간을 선택하고 주문을 완료하세요</p>
      </div>
      <CheckoutForm
        customerName={session.name}
        customerEmail={session.email}
        customerPhone={profile?.phone ?? null}
      />
    </div>
  );
}
