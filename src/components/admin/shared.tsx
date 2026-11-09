"use client";
import { RotateCcw, Package, ArrowUpRight } from "lucide-react";
import type { Order } from "@/lib/products";
import { money } from "@/lib/products";
export function QueryState({
  pending,
  error,
  retry,
  empty,
  children,
}: {
  pending: boolean;
  error: Error | null;
  retry: () => unknown;
  empty?: boolean;
  children: React.ReactNode;
}) {
  if (pending)
    return (
      <div className="admin-loading" aria-label="Loading dashboard">
        <div />
        <div />
        <div />
      </div>
    );
  if (error)
    return (
      <div className="admin-empty" role="alert">
        <RotateCcw />
        <h2>Let’s get this connected.</h2>
        <p>{error.message}</p>
        <button className="button" onClick={() => retry()}>
          Retry <RotateCcw size={17} />
        </button>
      </div>
    );
  if (empty)
    return (
      <div className="admin-empty">
        <Package size={35} />
        <h2>Nothing here just yet.</h2>
        <p>New activity will appear here automatically.</p>
      </div>
    );
  return <>{children}</>;
}
export function OrderTable({ orders }: { orders: Order[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Items</th>
            <th>Total</th>
            <th>Received</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderRef}>
              <td>
                <strong>{order.orderRef}</strong>
              </td>
              <td>
                {order.items.map((item) => (
                  <div key={item.slug}>
                    {item.qty} × {item.name}
                  </div>
                ))}
              </td>
              <td className="admin-price">{money(order.total)}</td>
              <td>
                {new Date(order.receivedAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </td>
              <td>
                <span
                  className={`status ${order.placedOffline ? "offline-order" : ""}`}
                >
                  {order.placedOffline ? "Placed offline" : "Online"}
                  <ArrowUpRight size={12} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onClose,
  pending,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="eyebrow">PLEASE CONFIRM</div>
        <h2>{title}</h2>
        <p>{description}</p>
        <div>
          <button
            className="admin-secondary"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button danger"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Working…" : "Confirm"}
          </button>
        </div>
      </section>
    </div>
  );
}
