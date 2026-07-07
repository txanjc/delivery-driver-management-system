"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Icon, IconWeight } from "@phosphor-icons/react";

import { AppIcons } from "@/config/icons";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "filter"
  | "toggle"
  | "icon"
  | "destructive"
  | "ghost"
  | "mapControl"
  | "pagination";

type ButtonSize = "sm" | "md" | "lg" | "icon";

export type AppButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  active?: boolean;
  ariaLabel?: string;
  children?: ReactNode;
  icon?: Icon;
  iconWeight?: IconWeight;
  loading?: boolean;
  size?: ButtonSize;
  tooltip?: string;
  variant?: ButtonVariant;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-[#6d4aff] text-white shadow-sm shadow-purple-200 hover:bg-[#5d3ee8] hover:shadow-md active:bg-purple-800 focus-visible:ring-purple-300 disabled:bg-purple-300 disabled:text-white",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-purple-200 disabled:bg-slate-50 disabled:text-slate-400",
  filter:
    "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-purple-200 disabled:bg-slate-50 disabled:text-slate-400",
  toggle:
    "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-purple-200 disabled:bg-slate-50 disabled:text-slate-400",
  icon:
    "border border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 focus-visible:ring-purple-200 disabled:bg-slate-50 disabled:text-slate-400",
  destructive:
    "border border-red-200 bg-white text-red-600 hover:bg-red-50 focus-visible:ring-red-200 disabled:bg-red-50 disabled:text-red-300",
  ghost:
    "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-purple-200 disabled:text-slate-400",
  mapControl:
    "border border-white/80 bg-white/88 text-slate-700 shadow-[0_18px_48px_-28px_rgba(15,23,42,.35)] backdrop-blur-xl hover:bg-white focus-visible:ring-purple-200 disabled:text-slate-400",
  pagination:
    "border border-transparent bg-transparent text-slate-600 hover:bg-purple-50 hover:text-purple-700 focus-visible:ring-purple-300 disabled:text-slate-300",
};

const activeClasses: Partial<Record<ButtonVariant, string>> = {
  filter:
    "border-purple-300 bg-purple-50 text-purple-700 ring-2 ring-purple-100 hover:border-purple-300 hover:bg-purple-50",
  toggle:
    "border-purple-300 bg-purple-50 text-purple-700 ring-2 ring-purple-100 hover:border-purple-300 hover:bg-purple-50",
  pagination: "bg-[#6d4aff] text-white shadow-sm hover:bg-[#6d4aff] hover:text-white",
  mapControl: "border-purple-300 bg-purple-50 text-purple-700 ring-2 ring-purple-100",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-sm",
  icon: "h-11 w-11 p-0",
};

export function AppButton({
  active = false,
  ariaLabel,
  children,
  className,
  disabled,
  icon: Icon,
  iconWeight = "bold",
  loading = false,
  size = "md",
  title,
  tooltip,
  type = "button",
  variant = "secondary",
  ...props
}: AppButtonProps) {
  const SpinnerIcon = AppIcons.loading;
  const VisibleIcon = loading ? SpinnerIcon : Icon;
  const iconSize = size === "sm" ? 15 : size === "icon" ? 18 : 17;

  return (
    <button
      aria-label={ariaLabel}
      className={classes(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:shadow-none",
        sizeClasses[size],
        variantClasses[variant],
        active && activeClasses[variant],
        className,
      )}
      disabled={disabled || loading}
      title={tooltip ?? title}
      type={type}
      {...props}
    >
      {VisibleIcon ? (
        <VisibleIcon
          aria-hidden
          className={loading ? "animate-spin" : undefined}
          size={iconSize}
          weight={loading ? "bold" : iconWeight}
        />
      ) : null}
      {children}
    </button>
  );
}

export function PrimaryActionButton(props: AppButtonProps) {
  return <AppButton variant="primary" {...props} />;
}

export function SecondaryActionButton(props: AppButtonProps) {
  return <AppButton variant="secondary" {...props} />;
}

export function FilterChip(props: AppButtonProps) {
  return <AppButton aria-pressed={props.active} icon={props.icon ?? AppIcons.filter} variant="filter" {...props} />;
}

export function ToggleChip({
  active,
  icon,
  ...props
}: AppButtonProps) {
  return (
    <AppButton
      active={active}
      aria-pressed={active}
      icon={icon ?? (active ? AppIcons.checkedSquare : AppIcons.uncheckedSquare)}
      iconWeight={active ? "fill" : "bold"}
      variant="toggle"
      {...props}
    />
  );
}

export function IconButton(props: AppButtonProps) {
  return <AppButton size="icon" variant="icon" {...props} />;
}

export function DestructiveActionButton(props: AppButtonProps) {
  return <AppButton variant="destructive" {...props} />;
}
