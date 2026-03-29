"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { CartItem, SelectedOption } from "@/types/cart";

const CART_KEY = "beyond_cart";

interface Option { id: string; name: string; priceDelta: number; }
interface OptionGroup {
  id: string; name: string; minSelect: number; maxSelect: number;
  isRequired: boolean; options: Option[];
}
interface Product {
  id: string; name: string; description: string | null; category: string | null;
  basePrice: number; isSubscriptionEligible: boolean; isSoldOut: boolean;
  optionGroups: OptionGroup[];
}

interface Props { products: Product[]; }

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartItem[]; }
  catch { return []; }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function calcLineTotal(basePrice: number, options: SelectedOption[], qty: number) {
  const optionTotal = options.reduce((s, o) => s + o.priceDelta, 0);
  return Math.round((basePrice + optionTotal) * qty * 100) / 100;
}

function getCategories(products: Product[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of products) {
    const cat = p.category ?? "Other";
    if (!seen.has(cat)) { seen.add(cat); result.push(cat); }
  }
  return result;
}

// ── Category Tabs ──────────────────────────────────────────────────────────────

function CategoryTabs({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: string[];
  activeCategory: string;
  onSelect: (cat: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToTab(cat: string) {
    const container = scrollRef.current;
    if (!container) return;
    const btn = container.querySelector<HTMLButtonElement>(`[data-cat="${CSS.escape(cat)}"]`);
    if (btn) btn.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }

  return (
    <div className="sticky top-16 z-30 bg-white border-b border-gray-100 shadow-sm">
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto scroll-smooth px-4 py-2 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            data-cat={cat}
            onClick={() => { onSelect(cat); scrollToTab(cat); }}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              activeCategory === cat
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Product Card ───────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  const isSoldOut = product.isSoldOut;
  const hasOptions = product.optionGroups.length > 0;

  return (
    <button
      type="button"
      onClick={() => !isSoldOut && onOpen(product)}
      disabled={isSoldOut}
      className={`group text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-200 ${
        isSoldOut
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
      }`}
    >
      {/* Placeholder image area */}
      <div className="h-36 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center relative">
        <span className="text-5xl" aria-hidden="true">🥯</span>
        {isSoldOut && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            Sold Out
          </span>
        )}
        {product.isSubscriptionEligible && !isSoldOut && (
          <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            Subscribe
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-1.5">
        <h3 className="font-semibold text-gray-900 leading-tight">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{product.description}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-bold text-amber-600">
            {hasOptions ? "From " : ""}${product.basePrice.toFixed(2)}
          </span>
          {!isSoldOut && (
            <span className="text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
              {hasOptions ? "Customise +" : "Add +"}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Quantity Selector ─────────────────────────────────────────────────────────

function QuantitySelector({
  value,
  min,
  onChange,
}: {
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden select-none">
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-10 h-10 text-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors flex items-center justify-center"
      >
        −
      </button>
      <span className="w-10 text-center text-sm font-semibold text-gray-900">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-10 h-10 text-lg text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}

// ── Product Modal ─────────────────────────────────────────────────────────────

function ProductModal({
  product,
  onClose,
  onAddToCart,
}: {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, qty: number, selections: Record<string, string>, note: string) => string | null;
}) {
  const [qty, setQty] = useState(1);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // Lock scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const optionTotal = product.optionGroups.reduce((sum, g) => {
    const optId = selections[g.id];
    if (!optId) return sum;
    const opt = g.options.find((o) => o.id === optId);
    return sum + (opt?.priceDelta ?? 0);
  }, 0);
  const lineTotal = calcLineTotal(product.basePrice, Object.keys(selections).map((gid) => {
    const g = product.optionGroups.find((g) => g.id === gid);
    const opt = g?.options.find((o) => o.id === selections[gid]);
    if (!g || !opt) return null;
    return { optionGroupId: gid, optionGroupName: g.name, optionId: opt.id, optionName: opt.name, priceDelta: opt.priceDelta };
  }).filter(Boolean) as SelectedOption[], qty);

  function handleAdd() {
    const err = onAddToCart(product, qty, selections, note);
    if (err) { setError(err); return; }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] overflow-y-auto flex flex-col">
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Hero */}
        <div className="h-48 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center shrink-0">
          <span className="text-7xl" aria-hidden="true">🥯</span>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 flex-1">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
            {product.description && (
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{product.description}</p>
            )}
            <p className="text-xl font-bold text-amber-600 mt-2">
              ${product.basePrice.toFixed(2)}
              {optionTotal !== 0 && (
                <span className="text-sm text-gray-500 font-normal ml-1">
                  + ${optionTotal.toFixed(2)} options
                </span>
              )}
            </p>
          </div>

          {/* Option groups */}
          {product.optionGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">
                  {group.name}
                  {group.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                </p>
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                  {group.isRequired ? "Required" : "Optional"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {!group.isRequired && (
                  <button
                    type="button"
                    onClick={() => setSelections((s) => { const n = { ...s }; delete n[group.id]; return n; })}
                    className={`text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                      !selections[group.id]
                        ? "border-amber-400 bg-amber-50 text-amber-700 font-medium"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    None
                  </button>
                )}
                {group.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelections((s) => ({ ...s, [group.id]: opt.id }))}
                    className={`text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                      selections[group.id] === opt.id
                        ? "border-amber-400 bg-amber-50 text-amber-700 font-medium"
                        : "border-gray-200 text-gray-700 hover:border-amber-200 hover:bg-amber-50/50"
                    }`}
                  >
                    <span className="block">{opt.name}</span>
                    {opt.priceDelta !== 0 && (
                      <span className="text-xs text-gray-500">
                        {opt.priceDelta > 0 ? "+" : ""}${opt.priceDelta.toFixed(2)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Special instructions */}
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-gray-800">Special Instructions</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Allergies, special requests…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {/* Sticky bottom bar */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex items-center gap-3">
          <QuantitySelector value={qty} min={1} onChange={setQty} />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
          >
            Add to Order · ${lineTotal.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

// Height of fixed nav bar (64px) + sticky category tabs (~54px) + small gap
const SCROLL_DETECT_OFFSET = 130;
// Slightly larger offset for smooth scroll target so the section heading is visible
const SCROLL_TARGET_OFFSET = 130;

export default function ProductList({ products }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const categories = getCategories(products);

  // Initialise cart and default active category once on mount only
  useEffect(() => {
    setCart(loadCart());
    if (categories.length > 0) setActiveCategory(categories[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track active category on scroll
  useEffect(() => {
    function onScroll() {
      const scrollY = window.scrollY + SCROLL_DETECT_OFFSET;
      let current = categories[0] ?? "";
      for (const cat of categories) {
        const el = sectionRefs.current[cat];
        if (el && el.getBoundingClientRect().top + window.scrollY <= scrollY) {
          current = cat;
        }
      }
      setActiveCategory(current);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [categories]);

  function scrollToCategory(cat: string) {
    const el = sectionRefs.current[cat];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_TARGET_OFFSET;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveCategory(cat);
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = Math.round(cart.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;

  const handleAddToCart = useCallback((
    product: Product,
    qty: number,
    selections: Record<string, string>,
    _note: string,
  ): string | null => {
    // Validate required groups
    for (const group of product.optionGroups) {
      if (!group.isRequired) continue;
      if (!selections[group.id]) {
        return `Please select "${group.name}"`;
      }
    }

    const selectedOptions: SelectedOption[] = product.optionGroups
      .map((g) => {
        const optId = selections[g.id];
        if (!optId) return null;
        const opt = g.options.find((o) => o.id === optId);
        if (!opt) return null;
        return {
          optionGroupId: g.id,
          optionGroupName: g.name,
          optionId: opt.id,
          optionName: opt.name,
          priceDelta: opt.priceDelta,
        };
      })
      .filter(Boolean) as SelectedOption[];

    const newItem: CartItem = {
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      basePrice: product.basePrice,
      quantity: qty,
      selectedOptions,
      lineTotal: calcLineTotal(product.basePrice, selectedOptions, qty),
    };

    const updated = [...cart, newItem];
    setCart(updated);
    saveCart(updated);
    return null;
  }, [cart]);

  const productsByCategory: Record<string, Product[]> = {};
  for (const cat of categories) {
    productsByCategory[cat] = products.filter((p) => (p.category ?? "Other") === cat);
  }

  return (
    <div className="pb-28">
      {/* Category tabs */}
      {categories.length > 1 && (
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onSelect={scrollToCategory}
        />
      )}

      {/* Category sections */}
      <div className="space-y-10 mt-6">
        {categories.map((cat) => (
          <section
            key={cat}
            ref={(el) => { sectionRefs.current[cat] = el; }}
          >
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4 px-0.5">
              <h2 className="text-lg font-bold text-gray-900">{cat}</h2>
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">{productsByCategory[cat].length} items</span>
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {productsByCategory[cat].map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpen={setModalProduct}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Product modal */}
      {modalProduct && (
        <ProductModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-amber-600 text-white px-4 py-3 flex items-center justify-between z-40 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="bg-amber-700 rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold">
              {cartCount}
            </span>
            <span className="font-medium text-sm">{cartCount === 1 ? "item" : "items"} in cart</span>
            <span className="text-amber-200 text-sm">· ${cartTotal.toFixed(2)}</span>
          </div>
          <Link
            href="/order/cart"
            className="bg-white text-amber-700 font-semibold px-5 py-2 rounded-xl text-sm hover:bg-amber-50 transition-colors"
          >
            View Cart →
          </Link>
        </div>
      )}
    </div>
  );
}
