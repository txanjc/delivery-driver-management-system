import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

function classes(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AdminPageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
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
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={classes(
        "inline-flex items-center justify-center rounded-full bg-[#6d4aff] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-purple-200 transition hover:-translate-y-0.5 hover:bg-[#5d3ee8] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={classes(
        "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
