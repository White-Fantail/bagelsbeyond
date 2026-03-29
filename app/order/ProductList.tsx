"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { CartItem, SelectedOption } from "@/types/cart";

const CART_KEY = "beyond_cart";

interface Option { id: string; name: string; priceDelta: number; isSoldOut: boolean; }
interface OptionGroup {
  id: string; name: string; minSelect: number; maxSelect: number;
  isRequired: boolean; options: Option[];
}
interface Product {
  id: string; name: string; description: string | null; category: string | null;
  categoryOrder: number;
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
  // Use the minimum categoryOrder encountered for each category name so that
  // the sort is stable even if individual products carry slightly different values.
  const seen = new Map<string, number>();
  for (const p of products) {
    const cat = p.category ?? "Other";
    const order = p.categoryOrder;
    const current = seen.get(cat);
    if (current === undefined || order < current) seen.set(cat, order);
  }
  return Array.from(seen.entries())
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
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
    <div className="sticky top-16 z-30 bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto flex items-stretch">
        {/* Scrollable tab list */}
        <div
          ref={scrollRef}
          role="tablist"
          aria-label="Menu categories"
          className="flex flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={activeCategory === cat}
              data-cat={cat}
              onClick={() => { onSelect(cat); scrollToTab(cat); }}
              // -mb-px makes the 2px tab border sit on top of the 1px container border
              className={`shrink-0 px-4 py-3.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
                activeCategory === cat
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search placeholder — UI only, ready for future wiring */}
        <div className="hidden sm:flex items-center shrink-0 px-3 border-l border-gray-100">
          <button
            type="button"
            aria-label="Search menu items"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
              />
            </svg>
            <span>Search</span>
          </button>
        </div>
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
      aria-label={`${product.name}${isSoldOut ? ", sold out" : hasOptions ? ", select options" : ", add to order"}`}
      className={`group w-full text-left bg-white rounded-xl border border-gray-100 overflow-hidden transition-all duration-200 flex h-32 sm:h-36 ${
        isSoldOut
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-md hover:-translate-y-px cursor-pointer shadow-sm"
      }`}
    >
      {/* Left: text info (~70%) */}
      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
        <div>
          {isSoldOut ? (
            <span className="inline-block text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full mb-1.5">
              Sold out
            </span>
          ) : product.isSubscriptionEligible ? (
            <span className="inline-block text-xs font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full mb-1.5">
              Subscribe &amp; save
            </span>
          ) : null}
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base leading-snug line-clamp-2">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-0.5">
              {product.description}
            </p>
          )}
        </div>
        <p className="text-sm font-bold text-gray-900 mt-1">
          {hasOptions && (
            <span className="text-xs font-normal text-gray-500 mr-0.5">From </span>
          )}
          ${product.basePrice.toFixed(2)}
        </p>
      </div>

      {/* Right: image placeholder (~30%) */}
      <div className="relative w-28 sm:w-36 shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
          <span className="text-4xl sm:text-5xl" aria-hidden="true">🥯</span>
        </div>
        {!isSoldOut && (
          <div className="absolute bottom-2 right-2">
            <span className="w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 text-lg leading-none shadow-sm group-hover:bg-orange-500 group-hover:border-orange-500 group-hover:text-white transition-colors select-none">
              +
            </span>
          </div>
        )}
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

function getGroupSubtitle(group: OptionGroup): string {
  const { minSelect, maxSelect, isRequired } = group;
  if (!isRequired && maxSelect <= 1) return "Optional";
  if (minSelect === 1 && maxSelect === 1) return "Select 1";
  if (minSelect === maxSelect && minSelect > 0) return `Select ${minSelect}`;
  if (minSelect === 0 && maxSelect > 1) return `Choose up to ${maxSelect}`;
  if (minSelect > 0 && maxSelect > 1) return `Choose ${minSelect}–${maxSelect}`;
  return isRequired ? "Required" : "Optional";
}

function ProductModal({
  product,
  onClose,
  onAddToCart,
}: {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, qty: number, selections: Record<string, string[]>, note: string) => string | null;
}) {
  const [qty, setQty] = useState(1);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [groupErrors, setGroupErrors] = useState<Record<string, string>>({});

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Build flat list of selected options for price calculation
  const selectedOptions: SelectedOption[] = [];
  for (const group of product.optionGroups) {
    const optIds = selections[group.id] ?? [];
    for (const optId of optIds) {
      const opt = group.options.find((o) => o.id === optId);
      if (opt) {
        selectedOptions.push({
          optionGroupId: group.id,
          optionGroupName: group.name,
          optionId: opt.id,
          optionName: opt.name,
          priceDelta: opt.priceDelta,
        });
      }
    }
  }

  const lineTotal = calcLineTotal(product.basePrice, selectedOptions, qty);

  function toggleOption(group: OptionGroup, optId: string) {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      const isSingle = group.maxSelect === 1;
      if (isSingle) {
        // Radio: replace existing selection
        return { ...prev, [group.id]: [optId] };
      }
      // Checkbox: toggle membership, respecting maxSelect
      if (current.includes(optId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optId) };
      }
      if (current.length >= group.maxSelect) return prev; // max reached
      return { ...prev, [group.id]: [...current, optId] };
    });
    // Clear per-group error on interaction
    setGroupErrors((prev) => { const n = { ...prev }; delete n[group.id]; return n; });
    setError("");
  }

  function handleAdd() {
    const newGroupErrors: Record<string, string> = {};
    for (const group of product.optionGroups) {
      if (!group.isRequired) continue;
      const selected = selections[group.id] ?? [];
      if (selected.length < group.minSelect) {
        newGroupErrors[group.id] = getGroupSubtitle(group);
      }
    }
    if (Object.keys(newGroupErrors).length > 0) {
      setGroupErrors(newGroupErrors);
      setError("Please complete all required selections above.");
      return;
    }
    const err = onAddToCart(product, qty, selections, note);
    if (err) { setError(err); return; }
    onClose();
  }

  const hasRequiredUnfilled = product.optionGroups.some((g) => {
    if (!g.isRequired) return false;
    return (selections[g.id] ?? []).length < g.minSelect;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      {/* Dim overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative w-full sm:w-[480px] bg-white rounded-2xl shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">

        {/* ── Hero image ── */}
        <div className="relative h-52 sm:h-60 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center shrink-0">
          <span className="text-8xl" aria-hidden="true">🥯</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Product info */}
          <div className="px-5 pt-5 pb-4">
            <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
            {product.description && (
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{product.description}</p>
            )}
            <p className="text-sm font-semibold text-amber-600 mt-2">
              Starting from ${product.basePrice.toFixed(2)}
            </p>
          </div>

          {/* Modifier groups */}
          <div className="px-5 pb-4">
            {product.optionGroups.map((group) => {
              const selected = selections[group.id] ?? [];
              const isSingle = group.maxSelect === 1;
              const subtitle = getGroupSubtitle(group);
              const groupErr = groupErrors[group.id];

              return (
                <fieldset key={group.id} className="border-t border-gray-100 py-4">
                  {/* Group header */}
                  <div className="mb-3">
                    <legend className="text-sm font-semibold text-gray-900 w-full">{group.name}</legend>
                    <p className={`text-xs mt-0.5 ${groupErr ? "text-red-500 font-medium" : "text-gray-400"}`}>
                      {groupErr ? `Please ${subtitle.toLowerCase()}` : subtitle}
                    </p>
                  </div>

                  {/* Options list */}
                  <div className="divide-y divide-gray-50">
                    {group.options.map((opt) => {
                      const isSelected = selected.includes(opt.id);
                      const maxReached = !isSingle && !isSelected && selected.length >= group.maxSelect;
                      const isDisabled = opt.isSoldOut || maxReached;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role={isSingle ? "radio" : "checkbox"}
                          aria-checked={isSelected}
                          disabled={isDisabled && !isSelected}
                          onClick={() => !opt.isSoldOut && toggleOption(group, opt.id)}
                          className={`w-full flex items-center gap-3 py-3 text-left transition-colors rounded-sm ${
                            opt.isSoldOut
                              ? "cursor-not-allowed opacity-40"
                              : maxReached
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-gray-50 cursor-pointer"
                          }`}
                        >
                          {/* Option name + price delta */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-800">{opt.name}</span>
                            {opt.priceDelta !== 0 && (
                              <span className="block text-xs text-gray-400 mt-0.5">
                                {opt.priceDelta > 0 ? "+" : ""}${opt.priceDelta.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Right control */}
                          {opt.isSoldOut ? (
                            <span className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5 shrink-0 whitespace-nowrap">
                              Sold out
                            </span>
                          ) : isSingle ? (
                            /* Radio */
                            <div
                              aria-hidden="true"
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? "border-amber-500" : "border-gray-300"
                              }`}
                            >
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                            </div>
                          ) : (
                            /* Checkbox */
                            <div
                              aria-hidden="true"
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? "border-amber-500 bg-amber-500" : "border-gray-300"
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>

          {/* Special instructions */}
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-800 mb-1.5">Special Instructions</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Allergies, special requests…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {error && (
            <p className="px-5 pb-4 text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* ── Sticky footer ── */}
        <div className="border-t border-gray-100 px-5 py-4 flex items-center gap-3 bg-white">
          <QuantitySelector value={qty} min={1} onChange={setQty} />
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={hasRequiredUnfilled}
              aria-disabled={hasRequiredUnfilled}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap ${
                hasRequiredUnfilled
                  ? "bg-amber-300 text-white cursor-not-allowed"
                  : "bg-amber-600 text-white hover:bg-amber-700"
              }`}
            >
              Add to order — ${lineTotal.toFixed(2)}
            </button>
          </div>
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
    selections: Record<string, string[]>,
    _note: string,
  ): string | null => {
    // Validate required groups meet minimum selection
    for (const group of product.optionGroups) {
      if (!group.isRequired) continue;
      const selected = selections[group.id] ?? [];
      if (selected.length < group.minSelect) {
        return `Please select "${group.name}"`;
      }
    }

    // Build flat SelectedOption list preserving group order
    const selectedOptions: SelectedOption[] = [];
    for (const group of product.optionGroups) {
      const optIds = selections[group.id] ?? [];
      for (const optId of optIds) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) {
          selectedOptions.push({
            optionGroupId: group.id,
            optionGroupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: opt.priceDelta,
          });
        }
      }
    }

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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 mt-6">
        {categories.map((cat) => (
          <section
            key={cat}
            ref={(el) => { sectionRefs.current[cat] = el; }}
          >
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-bold text-gray-900 tracking-tight">{cat}</h2>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">{productsByCategory[cat].length} items</span>
            </div>

            {/* Product grid — 2 col on md+, 1 col on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
