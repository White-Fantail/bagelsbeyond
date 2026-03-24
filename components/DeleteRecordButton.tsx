"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

type Props = {
  recordId: string;
};

export default function DeleteRecordButton({ recordId }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sales/${recordId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제에 실패했습니다");
      router.push("/sales");
    } catch {
      setIsDeleting(false);
      setIsOpen(false);
      alert("삭제에 실패했습니다.");
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
      >
        삭제
      </button>
      <ConfirmDeleteDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        isDeleting={isDeleting}
      />
    </>
  );
}
