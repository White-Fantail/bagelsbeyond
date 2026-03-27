"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

type Props = {
  predictionId: string;
};

export default function DeletePredictionButton({ predictionId }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/predictions/${predictionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/predictions");
    } catch {
      setIsDeleting(false);
      setIsOpen(false);
      alert("Delete failed.");
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
      >
        Delete
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
