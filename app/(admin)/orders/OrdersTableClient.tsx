"use client";

import { Fragment, useMemo, useState, useTransition } from "react";

type OrderStatus =
  | "PENDING"
  | "SENT_TO_LOYVERSE"
  | "FAILED_TO_SEND"
  | "ACCEPTED"
  | "COMPLETED"
  | "CANCELLED"
  | "DRAFT";

type EditableStatus = "PENDING" | "ACCEPTED" | "COMPLETED" | "CANCELLED";

function toEditableStatus(status: OrderStatus): EditableStatus {
  if (status === "ACCEPTED" || status === "COMPLETED" || status === "CANCELLED") {
    return status;
  }
  return "PENDING";
}

type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  pickupType: string;
  pickupTimeLabel: string | null;
  notes: string | null;
  createdAtLabel: string;
  subtotalLabel: string;
  totalLabel: string;
  status: OrderStatus;
  loyverseReceiptId: string | null;
  loyverseSyncError: string | null;
  items: Array<{
    id: string;
    itemNameSnapshot: string;
    quantity: number;
    unitPriceLabel: string;
    totalPriceLabel: string;
    notes: string | null;
    modifiers: Array<{
      id: string;
      modifierGroupName: string;
      modifierOptionName: string;
      priceDeltaLabel: string;
    }>;
  }>;
};

const STATUS_OPTIONS: Array<{ value: EditableStatus; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function getOrderStatusBadge(status: OrderStatus) {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    case "ACCEPTED":
      return "bg-blue-100 text-blue-700";
    case "CANCELLED":
      return "bg-gray-200 text-gray-700";
    case "FAILED_TO_SEND":
      return "bg-red-100 text-red-700";
    case "SENT_TO_LOYVERSE":
      return "bg-emerald-100 text-emerald-700";
    case "PENDING":
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function getSyncBadge(order: OrderRow) {
  if (order.loyverseReceiptId) {
    return { text: "Synced", className: "bg-emerald-100 text-emerald-700" };
  }

  if (order.loyverseSyncError || order.status === "FAILED_TO_SEND") {
    return { text: "Failed", className: "bg-red-100 text-red-700" };
  }

  return { text: "Pending", className: "bg-gray-100 text-gray-600" };
}

export default function OrdersTableClient({ orders }: { orders: OrderRow[] }) {
  const [rows, setRows] = useState<OrderRow[]>(orders);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<Record<string, EditableStatus>>(
    Object.fromEntries(orders.map((order) => [order.id, toEditableStatus(order.status)]))
  );
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const retryableCount = useMemo(
    () => rows.filter((row) => !!row.loyverseSyncError || row.status === "FAILED_TO_SEND").length,
    [rows]
  );

  const updateRow = (orderId: string, updater: (row: OrderRow) => OrderRow) => {
    setRows((prev) => prev.map((row) => (row.id === orderId ? updater(row) : row)));
  };

  const handleRetrySync = (orderId: string) => {
    setBusyOrderId(orderId);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/orders/${orderId}/retry-sync`, {
          method: "POST",
        });
        const payload = (await response.json()) as {
          success?: boolean;
          status?: OrderStatus;
          receiptId?: string;
          loyverseSyncError?: string | null;
          error?: string;
          message?: string;
        };

        if (!response.ok) {
          throw new Error(payload.message || "Retry sync failed");
        }

        if (payload.success && payload.receiptId) {
          updateRow(orderId, (row) => ({
            ...row,
            status: payload.status ?? "SENT_TO_LOYVERSE",
            loyverseReceiptId: payload.receiptId ?? null,
            loyverseSyncError: null,
          }));
          return;
        }

        const errorText = payload.error || payload.loyverseSyncError || "Retry sync failed";
        updateRow(orderId, (row) => ({
          ...row,
          status: payload.status ?? "FAILED_TO_SEND",
          loyverseReceiptId: null,
          loyverseSyncError: errorText,
        }));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Retry sync failed");
      } finally {
        setBusyOrderId(null);
      }
    });
  };

  const handleStatusUpdate = (orderId: string) => {
    const nextStatus: EditableStatus = statusDraft[orderId] ?? "PENDING";
    setBusyOrderId(orderId);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/orders/${orderId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        });

        const payload = (await response.json()) as {
          message?: string;
          status?: OrderStatus;
        };

        if (!response.ok) {
          throw new Error(payload.message || "Status update failed");
        }

        updateRow(orderId, (row) => ({
          ...row,
          status: payload.status ?? nextStatus,
        }));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Status update failed");
      } finally {
        setBusyOrderId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total Orders</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-white p-4">
          <p className="text-xs text-red-600">Retry Needed</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{retryableCount}</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Order</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Created</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Loyverse Sync</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((order) => {
              const syncBadge = getSyncBadge(order);
              const isBusy = busyOrderId === order.id;

              return (
                <Fragment key={order.id}>
                <tr className="align-top">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedOrderId((prev) => (prev === order.id ? null : order.id))}
                      aria-expanded={expandedOrderId === order.id}
                      className="text-left text-sm font-semibold text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900"
                    >
                      {order.orderNumber}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">{order.customerName}</p>
                    <p>{order.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{order.createdAtLabel}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{order.totalLabel}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getOrderStatusBadge(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="space-y-1">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${syncBadge.className}`}>
                        {syncBadge.text}
                      </span>
                      {order.loyverseReceiptId ? (
                        <p className="text-xs text-gray-600">Receipt: {order.loyverseReceiptId}</p>
                      ) : null}
                      {order.loyverseSyncError ? (
                        <p className="max-w-xs truncate text-xs text-red-700" title={order.loyverseSyncError}>
                          {order.loyverseSyncError}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Order status for ${order.orderNumber}`}
                          value={statusDraft[order.id] ?? toEditableStatus(order.status)}
                          onChange={(event) =>
                            setStatusDraft((prev) => ({
                              ...prev,
                              [order.id]: event.target.value as EditableStatus,
                            }))
                          }
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                          disabled={isPending || isBusy}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          aria-label={`Update status for order ${order.orderNumber}`}
                          onClick={() => handleStatusUpdate(order.id)}
                          disabled={isPending || isBusy}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Update
                        </button>
                      </div>

                      <button
                        type="button"
                        aria-label={`Retry Loyverse sync for order ${order.orderNumber}`}
                        onClick={() => handleRetrySync(order.id)}
                        disabled={isPending || isBusy}
                        className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Retry Sync
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedOrderId === order.id ? (
                  <tr>
                    <td colSpan={7} className="bg-gray-50 px-4 py-4">
                      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
                        <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                          <div>
                            <p className="font-semibold text-gray-900">Customer</p>
                            <p>{order.customerName}</p>
                            <p>{order.customerPhone}</p>
                            {order.customerEmail ? <p>{order.customerEmail}</p> : null}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">Pickup</p>
                            <p>{order.pickupType}</p>
                            <p>{order.pickupTimeLabel ?? "ASAP"}</p>
                          </div>
                        </div>

                        <div className="text-sm text-gray-700">
                          <p className="font-semibold text-gray-900">Order Notes</p>
                          <p>{order.notes || "No notes"}</p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-900">Order Items ({order.items.length})</p>
                          {order.items.length === 0 ? (
                            <p className="text-sm text-gray-600">No order items found.</p>
                          ) : (
                            <div className="space-y-2">
                              {order.items.map((item) => (
                                <div key={item.id} className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="font-medium text-gray-900">
                                      {item.quantity} × {item.itemNameSnapshot}
                                    </p>
                                    <p className="font-semibold text-gray-900">{item.totalPriceLabel}</p>
                                  </div>
                                  <p className="text-xs text-gray-600">Unit Price: {item.unitPriceLabel}</p>
                                  {item.modifiers.length > 0 ? (
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-700">
                                      {item.modifiers.map((modifier) => (
                                        <li key={modifier.id}>
                                          {modifier.modifierGroupName}: {modifier.modifierOptionName} ({modifier.priceDeltaLabel})
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}
                                  {item.notes ? <p className="mt-2 text-xs text-gray-700">Item Notes: {item.notes}</p> : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                          <div>
                            <p className="font-semibold text-gray-900">Totals</p>
                            <p>Subtotal: {order.subtotalLabel}</p>
                            <p>Total: {order.totalLabel}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">Loyverse Error Detail</p>
                            {order.loyverseSyncError ? (
                              <pre className="whitespace-pre-wrap break-words rounded-md bg-red-50 p-2 text-xs text-red-700">
                                {order.loyverseSyncError}
                              </pre>
                            ) : (
                              <p>No sync error.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
