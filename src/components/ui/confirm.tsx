"use client";
import * as React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Dialog } from "./dialog";
import { Button } from "./button";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  tone = "primary",
  loading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      hideClose
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            size="lg"
            onClick={onConfirm}
            loading={loading}
            // Start on the confirm button only for harmless dialogs without fields. Danger dialogs
            // (and ones with a field such as "ketik HAPUS") must not be confirmable by one Enter.
            data-autofocus={tone !== "danger" && !children ? true : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center pt-4 text-center">
        <div
          className={
            tone === "danger"
              ? "mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-expense"
              : "mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-mint text-emerald-700"
          }
        >
          {tone === "danger" ? <AlertTriangle className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
        </div>
        <h2 className="text-xl font-bold text-charcoal">{title}</h2>
        {description && <div className="mt-2 text-[15px] leading-relaxed text-muted">{description}</div>}
        {children && <div className="mt-4 w-full text-left">{children}</div>}
      </div>
    </Dialog>
  );
}
