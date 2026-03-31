"use client";

import { CartProvider } from "@/lib/customer/cart-context";
import CustomerHeader from "@/components/customer/header";

interface CustomerLayoutInnerProps {
  children: React.ReactNode;
  session: { name: string; userId: string } | null;
}

function CustomerLayoutInner({ children, session }: CustomerLayoutInnerProps) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">
        <CustomerHeader session={session} />
        <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">{children}</main>
      </div>
    </CartProvider>
  );
}

export default CustomerLayoutInner;
