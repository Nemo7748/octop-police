/**
 * Vitest jsdom setup.
 *
 * Antd's components rely on a few browser APIs jsdom doesn't ship:
 *   - ``window.matchMedia`` (used by Grid responsive breakpoints)
 *   - ``ResizeObserver`` (used by Card/Drawer/Modal portals)
 *   - ``IntersectionObserver`` (used by virtual lists)
 *
 * Recharts also wants ``ResizeObserver`` for the ``ResponsiveContainer``;
 * it'll log a console error otherwise even though our snapshot tests
 * don't actually render the chart at a real size.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Auto-mock react-i18next so components' ``t(key, fallback)`` calls
// resolve synchronously to ``fallback`` without needing the real
// i18n module (which would async-fetch tool labels and add 1-2s of
// console noise per test file).
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string | { defaultValue?: string }) => {
        if (typeof fallback === "string") return fallback;
        if (fallback && typeof fallback === "object" && fallback.defaultValue)
          return fallback.defaultValue;
        return key;
      },
      i18n: { language: "zh", changeLanguage: () => Promise.resolve() },
    }),
    Trans: ({ children }: { children?: React.ReactNode }) => children,
  };
});

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined") {
  // Node >=22 ships an experimental ``localStorage`` getter that yields
  // ``undefined`` unless Node runs with ``--localstorage-file``, and it
  // shadows jsdom's working Storage. Re-install a usable one when the
  // getter comes up empty (prefer jsdom's, fall back to in-memory).
  const globalScope = globalThis as { localStorage?: Storage };
  let storageUsable = false;
  try {
    storageUsable = typeof globalScope.localStorage?.clear === "function";
  } catch {
    storageUsable = false;
  }
  if (!storageUsable) {
    class MemoryStorage implements Storage {
      private entries = new Map<string, string>();
      get length(): number {
        return this.entries.size;
      }
      clear(): void {
        this.entries.clear();
      }
      getItem(key: string): string | null {
        return this.entries.has(key)
          ? (this.entries.get(key) as string)
          : null;
      }
      key(index: number): string | null {
        return Array.from(this.entries.keys())[index] ?? null;
      }
      removeItem(key: string): void {
        this.entries.delete(key);
      }
      setItem(key: string, value: string): void {
        this.entries.set(key, String(value));
      }
    }
    const jsdomStorage = (window as { localStorage?: Storage }).localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: jsdomStorage ?? new MemoryStorage(),
      configurable: true,
      writable: true,
    });
  }

  // matchMedia
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  // ResizeObserver
  class _ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  if (!window.ResizeObserver) {
    (
      window as unknown as { ResizeObserver: typeof _ResizeObserver }
    ).ResizeObserver = _ResizeObserver;
  }

  // IntersectionObserver
  class _IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  if (!window.IntersectionObserver) {
    (
      window as unknown as {
        IntersectionObserver: typeof _IntersectionObserver;
      }
    ).IntersectionObserver = _IntersectionObserver;
  }

  // jsdom doesn't implement ``getComputedStyle().transition`` properly,
  // so antd's wave / motion can throw — silence that one noisy console
  // warning without hiding real errors.
  const _origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      (first.includes(
        "Not implemented: HTMLFormElement.prototype.requestSubmit",
      ) ||
        first.includes("React does not recognize the") ||
        first.includes("antd: ") ||
        first.includes("[antd:"))
    ) {
      return;
    }
    _origError(...args);
  };
}
