"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Modal } from "@/components/ui";

// Themed replacement for the browser's window.confirm():
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Delete vimal?", message: "…", confirmLabel: "Delete", danger: true }))) return;

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button and warning icon, for permanent or destructive actions. */
  danger?: boolean;
}

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    resolver.current?.(false); // a newer question replaces an unanswered one
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  }, []);
  const cancel = useCallback(() => answer(false), [answer]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Modal
          open
          size="sm"
          onClose={cancel}
          title={opts.title}
          footer={
            <>
              <Button variant="ghost" onClick={cancel}>
                {opts.cancelLabel ?? "Cancel"}
              </Button>
              <Button variant={opts.danger ? "danger" : "primary"} onClick={() => answer(true)}>
                {opts.confirmLabel ?? "OK"}
              </Button>
            </>
          }
        >
          <div className="flex gap-3 text-sm">
            {opts.danger && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fbeceb] text-danger">
                <AlertTriangle size={18} aria-hidden />
              </span>
            )}
            <div className="space-y-2 leading-relaxed text-charcoal">{opts.message}</div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
