"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface CartModifier {
  modifierOptionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartLine {
  id: string;
  itemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  modifiers: CartModifier[];
  lineTotal: number;
  imageUrl?: string | null;
  note?: string;
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addLine: (line: Omit<CartLine, "id" | "lineTotal">) => void;
  updateQuantity: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEY = "bb_cart_v1";

function computeLineId(itemId: string, modifiers: CartModifier[]): string {
  const modKey = [...modifiers]
    .sort((a, b) => a.modifierOptionId.localeCompare(b.modifierOptionId))
    .map(m => m.modifierOptionId)
    .join(",");
  return `${itemId}__${modKey}`;
}

function computeLineTotal(unitPrice: number, modifiers: CartModifier[], quantity: number): number {
  const optTotal = modifiers.reduce((s, m) => s + m.priceDelta, 0);
  return Math.round((unitPrice + optTotal) * quantity * 100) / 100;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const addLine = useCallback((incoming: Omit<CartLine, "id" | "lineTotal">) => {
    const id = computeLineId(incoming.itemId, incoming.modifiers);
    const lineTotal = computeLineTotal(incoming.unitPrice, incoming.modifiers, incoming.quantity);
    setLines(prev => {
      const existing = prev.find(l => l.id === id);
      if (existing) {
        return prev.map(l =>
          l.id === id
            ? { ...l, quantity: l.quantity + incoming.quantity, lineTotal: computeLineTotal(l.unitPrice, l.modifiers, l.quantity + incoming.quantity) }
            : l
        );
      }
      return [...prev, { ...incoming, id, lineTotal }];
    });
  }, []);

  const updateQuantity = useCallback((lineId: string, qty: number) => {
    if (qty <= 0) {
      setLines(prev => prev.filter(l => l.id !== lineId));
    } else {
      setLines(prev =>
        prev.map(l =>
          l.id === lineId
            ? { ...l, quantity: qty, lineTotal: computeLineTotal(l.unitPrice, l.modifiers, qty) }
            : l
        )
      );
    }
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines(prev => prev.filter(l => l.id !== lineId));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;

  return (
    <CartContext.Provider value={{ lines, itemCount, subtotal, addLine, updateQuantity, removeLine, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
