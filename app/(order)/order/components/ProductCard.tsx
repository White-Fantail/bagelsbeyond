"use client";

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sellingPrice: number | null;
  isPopular: boolean;
  isSoldOut: boolean;
};

type ProductCardProps = {
  product: Product;
  quantityInCart: number;
  onClick: () => void;
};

export default function ProductCard({
  product,
  quantityInCart,
  onClick,
}: ProductCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={product.isSoldOut}
      className={`w-full text-left p-4 bg-white rounded-lg border hover:border-indigo-300 hover:shadow-md transition-all ${
        product.isSoldOut ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="font-semibold text-gray-900">{product.name}</h3>
            {product.isPopular && (
              <span className="px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded">
                Popular
              </span>
            )}
          </div>
          {product.description && (
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
              {product.description}
            </p>
          )}
          <p className="mt-2 text-lg font-semibold text-indigo-600">
            {product.isSoldOut ? (
              <span className="text-red-600">Sold Out</span>
            ) : product.sellingPrice ? (
              `$${product.sellingPrice.toFixed(2)}`
            ) : (
              "Price unavailable"
            )}
          </p>
        </div>
        <div className="relative flex-shrink-0">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-16 h-16 object-cover rounded-lg"
            />
          ) : (
            <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
          {quantityInCart > 0 && !product.isSoldOut && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
              {quantityInCart}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
