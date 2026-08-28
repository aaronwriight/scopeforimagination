"use client";

import { useEffect, useState } from "react";

import { SITE_THEME_STORAGE_KEY, type SiteTheme } from "@/lib/site-theme";

function applyTheme(theme: SiteTheme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const nextTheme: SiteTheme = isDark ? "light" : "dark";
    applyTheme(nextTheme);
    setIsDark(nextTheme === "dark");

    try {
      window.localStorage.setItem(SITE_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The selected theme still applies for this page when storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to night mode"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to night mode"}
      className="inline-flex cursor-pointer items-center gap-1.5 text-xs lowercase tracking-wider text-stone-500 transition-colors hover:text-[#6f8200] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#859900]"
    >
      <span>night</span>
      <span
        aria-hidden="true"
        className="relative h-3.5 w-7 rounded-full border border-stone-400 bg-stone-100 transition-colors dark:border-stone-600 dark:bg-stone-800"
      >
        <span className="absolute left-0.5 top-0.5 h-2 w-2 rounded-full bg-stone-500 transition-transform dark:translate-x-3 dark:bg-stone-300" />
      </span>
    </button>
  );
}
