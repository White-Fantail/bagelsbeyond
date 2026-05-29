"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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

export default function OrderingPage({ initialData }: OrderingPageProps) {
  const router = useRouter();
  const { store, categories } = initialData;

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    categories[0]?.id || null
  );
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("bagelsbeyond-cart");
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
    localStorage.setItem("bagelsbeyond-cart", JSON.stringify(cart));
  }, [cart]);

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Cart total
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.itemTotal, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Get quantity of a product in cart
  const getProductQuantityInCart = (productId: string): number => {
    return cart
      .filter((item) => item.itemId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Add item to cart
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

    const newItem: CartItem = {
      cartItemId: `${Date.now()}-${Math.random()}`,
      itemId: product.id,
      itemName: product.name,
      unitPrice,
      quantity,
      selectedModifiers,
      notes,
      itemTotal,
    };

    setCart((prev) => [...prev, newItem]);
    setSelectedProduct(null);
  };

  // Filter products by search
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

  // Get current category or first category if not set
  const currentCategory = useMemo(() => {
    return (
      filteredCategories.find((cat) => cat.id === selectedCategoryId) ||
      filteredCategories[0]
    );
  }, [filteredCategories, selectedCategoryId]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="relative h-48 bg-gradient-to-br from-indigo-600 to-violet-700">
        {store.bannerImageUrl ? (
          <img
            src={store.bannerImageUrl}
            alt={store.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center">
              <h1 className="text-3xl font-bold">{store.name}</h1>
              <p className="text-lg mt-2 opacity-90">
                Bagels • Coffee • Sandwiches • Pick-up
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Header (appears when scrolled) */}
      {scrolled && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b shadow-sm">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/")}
                className="text-gray-600 hover:text-gray-900"
                aria-label="Home"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </button>
              <span className="font-semibold text-gray-900">{store.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100"
              >
                Categories
              </button>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 text-gray-600 hover:text-gray-900"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
          {showSearch && (
            <div className="border-t px-4 py-3">
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
          )}
        </div>
      )}

      {/* Store Info */}
      <div className="max-w-md mx-auto px-4 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Pick-up • {store.isOpen ? "Open now" : "Closed"}
            </p>
            <p className="text-sm font-medium text-indigo-700">
              ASAP (20 mins)
            </p>
          </div>
          {store.phone && (
            <a
              href={`tel:${store.phone}`}
              className="text-sm text-indigo-600 hover:text-indigo-800 underline"
            >
              {store.phone}
            </a>
          )}
        </div>
      </div>

      {/* Category Navigation */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-md mx-auto overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 py-3">
            {filteredCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  cat.id === selectedCategoryId
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-md mx-auto px-4 py-6 pb-32">
        {currentCategory && (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {currentCategory.name}
            </h2>
            <div className="space-y-4">
              {currentCategory.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantityInCart={getProductQuantityInCart(product.id)}
                  onClick={() => setSelectedProduct(product)}
                />
              ))}
            </div>
          </>
        )}

        {filteredCategories.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No products found matching "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Cart Bar */}
      {cartItemCount > 0 && <CartBar itemCount={cartItemCount} total={cartTotal} />}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <CategoryModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onSelectCategory={(catId) => {
            setSelectedCategoryId(catId);
            setShowCategoryModal(false);
          }}
        />
      )}
    </div>
  );
}
