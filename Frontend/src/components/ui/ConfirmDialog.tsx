import type { ReactNode } from "react";
import { Button } from "./Button";
import { DialogShell } from "./Dialog";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = "primary",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "violet" | "danger";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <DialogShell open={open} onClose={onClose} labelledBy="confirm-title" panelClassName="max-w-md p-6">
      <h2 id="confirm-title" className="text-section font-bold">
        {title}
      </h2>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
          Cancelar
        </Button>
        <Button data-autofocus variant={tone} onClick={onConfirm} className="w-full sm:w-auto">
          {confirmLabel}
        </Button>
      </div>
    </DialogShell>
  );
}
