"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `"${productName}" 상품을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
    );
    if (!confirmed) return;

    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "삭제에 실패했습니다");
      }
      router.push("/admin/products");
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "삭제에 실패했습니다");
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDelete}
        disabled={status === "loading"}
        className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {status === "loading" ? "삭제 중..." : "상품 삭제"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
