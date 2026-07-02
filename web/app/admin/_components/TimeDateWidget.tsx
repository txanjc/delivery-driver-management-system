"use client";

import { useEffect, useState } from "react";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function TimeDateWidget() {
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentDate(new Date());
    }, 0);

    const intervalId = window.setInterval(() => {
      setCurrentDate(new Date());
    }, 60_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div
      aria-label={
        currentDate
          ? `Current time and date: ${timeFormatter.format(currentDate)}, ${dateFormatter.format(currentDate)}`
          : "Current time and date"
      }
      className="flex h-10 w-fit items-center rounded-xl border border-white/80 bg-gradient-to-br from-white/95 via-white/80 to-indigo-50/80 px-3.5 text-slate-700 shadow-[0_8px_24px_-14px_rgba(79,70,229,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/70 backdrop-blur-xl"
    >
      <time
        className="min-w-[4.75rem] whitespace-nowrap text-center text-xs font-semibold tracking-[0.01em] text-slate-800 tabular-nums"
        dateTime={currentDate?.toISOString()}
      >
        {currentDate ? timeFormatter.format(currentDate) : "--:-- --"}
      </time>

      <span
        aria-hidden
        className="mx-3 h-5 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent"
      />

      <span className="flex items-center gap-2.5 whitespace-nowrap text-xs font-semibold text-slate-700">
        <svg
          aria-hidden
          className="h-3.5 w-3.5 text-indigo-500"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
          viewBox="0 0 24 24"
        >
          <path d="M7 3v3M17 3v3M4 9h16" />
          <rect height="17" rx="2" width="18" x="3" y="4" />
          <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
        </svg>
        <time dateTime={currentDate?.toISOString()}>
          {currentDate ? dateFormatter.format(currentDate) : "--- --"}
        </time>
      </span>
    </div>
  );
}
