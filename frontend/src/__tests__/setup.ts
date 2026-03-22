import "@testing-library/jest-dom/vitest";
import "../i18n/index.js";

// Polyfill Element.scrollIntoView for radix-ui Select in jsdom/happy-dom
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function () {};
}

// Polyfill ResizeObserver for radix-ui components in jsdom/happy-dom
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}
