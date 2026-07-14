"use client";

import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

type AppModalShellProps = {
  children: ReactNode;
  dialogClassName?: string;
  dialogRef?: RefObject<HTMLDivElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  label: string;
  onClose: () => void;
  open: boolean;
  placement?: "center" | "search";
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function AppModalShell({
  children,
  dialogClassName = "",
  dialogRef,
  initialFocusRef,
  label,
  onClose,
  open,
  placement = "center",
  returnFocusRef,
}: AppModalShellProps) {
  const internalDialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef?.current ?? internalDialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnFocusTarget = returnFocusRef?.current ?? previouslyFocused;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const focusTimer = window.setTimeout(() => {
      const focusTarget = initialFocusRef?.current ?? dialog?.querySelector<HTMLElement>(focusableSelector) ?? dialog;
      focusTarget?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.setTimeout(() => {
        if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
      }, 0);
    };
  }, [dialogRef, initialFocusRef, open, returnFocusRef]);

  if (!open || typeof document === "undefined") return null;

  const placementClass = placement === "search"
    ? "items-start justify-center px-4 pt-[18vh]"
    : "items-center justify-center p-4 sm:p-6";

  return createPortal(
    <>
      <button
        aria-label={`Close ${label}`}
        className="fixed inset-0 z-[50] cursor-default bg-slate-950/55 backdrop-blur-[9px] transition-opacity motion-reduce:transition-none"
        onMouseDown={onClose}
        type="button"
      />
      <div className={`pointer-events-none fixed inset-0 z-[80] flex ${placementClass}`}>
        <div
          aria-label={label}
          aria-modal="true"
          className={`pointer-events-auto ${dialogClassName}`}
          ref={(node) => {
            internalDialogRef.current = node;
            if (dialogRef) dialogRef.current = node;
          }}
          role="dialog"
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
