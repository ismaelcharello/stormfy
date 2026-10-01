import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
Object.defineProperty(window, "matchMedia", { writable: true, value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView = () => {};
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
