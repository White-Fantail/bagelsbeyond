"use client";

import { useEffect } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl?: string | null;
};

type CategoryModalProps = {
  categories: Category[];
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void;
};

export default function CategoryModal({
  categories,
  onClose,
  onSelectCategory,
}: CategoryModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Browse categories</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
            aria-label="Close"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Categories Grid */}
        <div className="overflow-y-auto">
          <div className="p-4 grid grid-cols-2 gap-3 pb-8">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className="flex flex-col overflow-hidden rounded-xl border border-gray-100 hover:border-indigo-300 transition-colors text-left"
              >
                {/* Category image */}
                <div className="w-full aspect-square bg-gray-100 overflow-hidden">
                  {category.imageUrl ? (
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                      <svg
                        className="w-10 h-10 text-indigo-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {category.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
