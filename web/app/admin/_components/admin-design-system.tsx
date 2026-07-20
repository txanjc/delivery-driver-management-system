import Link from "next/link";
import type { ReactNode } from "react";

import {
  type AppButtonProps,
  PrimaryActionButton as BasePrimaryActionButton,
  SecondaryActionButton,
} from "@/components/ui/AppButton";
import { Skeleton } from "@/components/ui/Skeleton";

function classes(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AdminPageIntro({
  eyebrow,
  title,
  description,
  actions,
  loading = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-2xl">
          <Skeleton className="h-4 w-28" rounded="rounded-full" />
          <Skeleton className="mt-3 h-9 w-48" rounded="rounded-full" />
          <Skeleton className="mt-3 h-4 w-full max-w-xl" rounded="rounded-full" />
        </div>
        {actions ? <Skeleton className="h-11 w-36 shrink-0" rounded="rounded-full" /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-400">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-[#17232b]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminFilterBarSkeleton({
  className,
  count,
}: {
  className: string;
  count: number;
}) {
  return (
    <AdminCard className="p-4">
      <div aria-busy="true" className={`grid gap-3 ${className}`}>
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton className="h-11 w-full" key={index} rounded="rounded-full" />
        ))}
      </div>
    </AdminCard>
  );
}

export function AdminCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={classes(
        "rounded-[20px] border border-slate-100 bg-white shadow-sm shadow-slate-200/40",
        className,
      )}
    >
      {children}
    </article>
  );
}

export function PrimaryActionLink({
  children,
  href,
  className,
}: {
  children: ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <Link
      className={classes(
        "inline-flex items-center justify-center rounded-full bg-[#6d4aff] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-purple-200 transition hover:-translate-y-0.5 hover:bg-[#5d3ee8] hover:shadow-md",
        className,
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

export function PrimaryActionButton({
  className,
  children,
  ...props
}: AppButtonProps) {
  return (
    <BasePrimaryActionButton className={className} {...props}>
      {children}
    </BasePrimaryActionButton>
  );
}

export function SecondaryButton({
  className,
  children,
  ...props
}: AppButtonProps) {
  return (
    <SecondaryActionButton className={className} {...props}>
      {children}
    </SecondaryActionButton>
  );
}
