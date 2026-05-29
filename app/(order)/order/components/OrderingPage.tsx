"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { CART_STORAGE_KEY } from "../constants";
import ProductCard from "./ProductCard";
import ProductDetailModal from "./ProductDetailModal";
import CategoryModal from "./CategoryModal";
import CartBar from "./CartBar";

// Re-export types from page.tsx
type Store = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  suburb: string | null;
  city: string | null;
  phone: string | null;
  bannerImageUrl: string | null;
  logoImageUrl: string | null;
  isOpen: boolean;
};

type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};

type ModifierGroup = {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: ModifierOption[];
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sellingPrice: number | null;
  isPopular: boolean;
  isSoldOut: boolean;
  modifierGroups: ModifierGroup[];
};

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  products: Product[];
};

export type CartItem = {
  cartItemId: string;
  itemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  selectedModifiers: Array<{
    modifierGroupId: string;
    modifierGroupName: string;
    modifierOptionId: string;
    modifierOptionName: string;
    priceDelta: number;
  }>;
  notes?: string;
  itemTotal: number;
};

type OrderingPageProps = {
  initialData: {
    store: Store;
    categories: Category[];
  };
  storeSlug: string;
};

const HERO_HEIGHT = 192; // h-48 = 12rem
// How many px from the top of the viewport a category header must be before it's
// considered "active" in the scroll spy.
const SCROLL_SPY_TOP_OFFSET = "-100px";
// What fraction of the viewport below the top can be ignored — keeps sections
// near the bottom of the screen from stealing the active label prematurely.
const SCROLL_SPY_BOTTOM_OFFSET = "-60%";
// Small delay (ms) so the CategoryModal finishes its close animation before
// window.scrollTo fires, preventing a visual jump.
const MODAL_CLOSE_DELAY_MS = 50;

export default function OrderingPage({ initialData }: OrderingPageProps) {
  const router = useRouter();
  const { store, categories } = initialData;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    categories[0]?.id || null
  );

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Load cart from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load cart:", e);
      }
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll spy: update active category as user scrolls
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    categories.forEach((cat) => {
      const el = categoryRefs.current[cat.id];
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setActiveCategoryId(cat.id);
          }
        },
        { rootMargin: `${SCROLL_SPY_TOP_OFFSET} 0px ${SCROLL_SPY_BOTTOM_OFFSET} 0px`, threshold: 0 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [categories]);

  // Derived scroll states
  const heroOpacity = Math.max(0, 1 - scrollY / HERO_HEIGHT);
  const showStickyHeader = scrollY > 60;
  const showCategoryDropdown = scrollY > HERO_HEIGHT;

  // Cart totals
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.itemTotal, 0),
    [cart]
  );
  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const getProductQuantityInCart = (productId: string): number =>
    cart
      .filter((item) => item.itemId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);

  const handleAddToCart = (
    product: Product,
    quantity: number,
    selectedModifiers: CartItem["selectedModifiers"],
    notes?: string
  ) => {
    const basePrice = product.sellingPrice || 0;
    const modifierPrice = selectedModifiers.reduce(
      (sum, mod) => sum + mod.priceDelta,
      0
    );
    const unitPrice = basePrice + modifierPrice;
    const itemTotal = unitPrice * quantity;

    setCart((prev) => [
      ...prev,
      {
        cartItemId: `${Date.now()}-${Math.random()}`,
        itemId: product.id,
        itemName: product.name,
        unitPrice,
        quantity,
        selectedModifiers,
        notes,
        itemTotal,
      },
    ]);
    setSelectedProduct(null);
  };

  // Filter products by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        products: cat.products.filter(
          (prod) =>
            prod.name.toLowerCase().includes(query) ||
            prod.description?.toLowerCase().includes(query)
        ),
      }))
      .filter((cat) => cat.products.length > 0);
  }, [categories, searchQuery]);

  const activeCategory =
    categories.find((c) => c.id === activeCategoryId) || categories[0];

  // Scroll to a category section (offsetting for sticky header)
  const scrollToCategory = (catId: string) => {
    const el = categoryRefs.current[catId];
    if (!el) return;
    const stickyHeight = showCategoryDropdown ? 112 : 60;
    const y = el.getBoundingClientRect().top + window.scrollY - stickyHeight;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  // Categories enriched with their first product image for the modal grid
  const categoriesWithImages = categories.map((cat) => ({
    ...cat,
    imageUrl: cat.products[0]?.imageUrl ?? null,
  }));

  const storeSubtitle = [store.address, store.suburb, store.city]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Banner — fades as user scrolls */}
      <div
        className="relative h-48 overflow-hidden"
        style={{ opacity: heroOpacity }}
      >
        {store.bannerImageUrl ? (
          <img
            src={store.bannerImageUrl}
            alt={store.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center">
            <h1 className="text-3xl font-bold text-white">{store.name}</h1>
          </div>
        )}
      </div>

      {/* Sticky Header — slides in as hero fades */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 bg-white transition-all duration-200 ${
          showStickyHeader
            ? "shadow-sm opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-md mx-auto">
          {/* Title row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => router.push("/")}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-100"
              aria-label="Back"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">{store.name}</p>
              {storeSubtitle && (
                <p className="text-xs text-gray-500 truncate">{storeSubtitle}</p>
              )}
            </div>
            {/* Search icon only when category dropdown isn't showing */}
            {!showCategoryDropdown && (
              <button
                onClick={() => setShowSearch((s) => !s)}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-100"
                aria-label="Search"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Category dropdown row — appears once hero is gone */}
          {showCategoryDropdown && (
            <div className="flex items-center gap-2 px-4 pb-3">
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-left"
              >
                <svg
                  className="w-5 h-5 text-gray-600 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h7"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {activeCategory?.name}
                </span>
              </button>
              <button
                onClick={() => setShowSearch((s) => !s)}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                aria-label="Search"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Search bar */}
          {showSearch && (
            <div className="border-t px-4 py-3">
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>

      {/* Store Info */}
      <div className="max-w-md mx-auto bg-white px-4 pt-5 pb-4 border-b">
        {store.logoImageUrl && (
          <div className="mb-3">
            <img
              src={store.logoImageUrl}
              alt="Store logo"
              className="w-20 h-20 rounded-2xl object-cover shadow"
            />
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Bagels • Coffee • Sandwiches
        </p>
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <span>
              Pick-up • {store.isOpen ? "ASAP (20 mins)" : "Closed"}
            </span>
          </div>
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>

      {/* All Categories + Products (single scrollable list) */}
      <div className="max-w-md mx-auto pb-32">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No products found matching &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : (
          filteredCategories.map((cat) => (
            <div
              key={cat.id}
              ref={(el) => {
                categoryRefs.current[cat.id] = el;
              }}
            >
              <h2 className="text-2xl font-bold text-gray-900 px-4 pt-6 pb-3">
                {cat.name}
              </h2>
              <div className="space-y-3 px-4">
                {cat.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantityInCart={getProductQuantityInCart(product.id)}
                    onClick={() => setSelectedProduct(product)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Bar */}
      {cartItemCount > 0 && (
        <CartBar itemCount={cartItemCount} total={cartTotal} />
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Category Browse Modal */}
      {showCategoryModal && (
        <CategoryModal
          categories={categoriesWithImages}
          onClose={() => setShowCategoryModal(false)}
          onSelectCategory={(catId) => {
            setShowCategoryModal(false);
            // Small delay so modal closes before scrolling
            setTimeout(() => scrollToCategory(catId), MODAL_CLOSE_DELAY_MS);
          }}
        />
      )}
    </div>
  );
}
