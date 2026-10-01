"use client";

import { useEffect, useRef } from "react";
import { Bold, Eraser, Heading2, Italic, List, ListOrdered, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "A"]);
const blockedTags = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG"]);

export function plainTextToRichHtml(value: string) {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return value.trim() ? value.trim().split(/\n{2,}/).map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, "<br>")}</p>`).join("") : "";
}

export function sanitizeRichHtml(value: string) {
  if (typeof document === "undefined") return "";
  const parsed = new DOMParser().parseFromString(value, "text/html");
  const clean = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "");
    if (!(node instanceof Element)) return null;
    if (blockedTags.has(node.tagName)) return null;
    const tag = node.tagName === "DIV" ? "P" : node.tagName;
    const children = Array.from(node.childNodes).map(clean).filter((child): child is Node => Boolean(child));
    if (node.tagName === "SPAN") {
      let wrapper: HTMLElement | DocumentFragment = document.createDocumentFragment();
      const style = node.getAttribute("style") || "";
      if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) wrapper = document.createElement("strong");
      else if (/font-style\s*:\s*italic/i.test(style)) wrapper = document.createElement("em");
      else if (/text-decoration[^;]*underline/i.test(style)) wrapper = document.createElement("u");
      children.forEach((child) => wrapper.appendChild(child));
      return wrapper;
    }
    if (!allowedTags.has(tag)) {
      const fragment = document.createDocumentFragment();
      children.forEach((child) => fragment.appendChild(child));
      return fragment;
    }
    const element = document.createElement(tag.toLowerCase());
    children.forEach((child) => element.appendChild(child));
    if (tag === "A") {
      const href = node.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        element.setAttribute("href", href);
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
    }
    return element;
  };
  const container = document.createElement("div");
  Array.from(parsed.body.childNodes).map(clean).filter((node): node is Node => Boolean(node)).forEach((node) => container.appendChild(node));
  return container.innerHTML;
}

function insertHtml(html: string, target: HTMLElement) {
  if (document.queryCommandSupported?.("insertHTML")) {
    document.execCommand("insertHTML", false, html);
    return;
  }
  const selection = window.getSelection();
  if (!selection?.rangeCount || !target.contains(selection.anchorNode)) { target.insertAdjacentHTML("beforeend", html); return; }
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const fragment = range.createContextualFragment(html);
  range.insertNode(fragment);
  selection.collapseToEnd();
}

export function RichTextEditor({ id, label, valueHtml, valueText, disabled, placeholder, maxLength = 20000, onChange }: {
  id?: string; label: string; valueHtml: string; valueText: string; disabled?: boolean; placeholder?: string; maxLength?: number;
  onChange: (value: { html: string; text: string }) => void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor.current || document.activeElement === editor.current) return;
    const next = sanitizeRichHtml(valueHtml) || plainTextToRichHtml(valueText);
    if (editor.current.innerHTML !== next) editor.current.innerHTML = next;
  }, [valueHtml, valueText]);

  const emit = () => {
    if (!editor.current) return;
    const html = editor.current.innerHTML;
    const text = (editor.current.innerText ?? editor.current.textContent ?? "").trim();
    if (text.length > maxLength) {
      editor.current.innerHTML = sanitizeRichHtml(valueHtml) || plainTextToRichHtml(valueText);
      return;
    }
    onChange({ html, text });
  };
  const command = (name: string, value?: string) => {
    editor.current?.focus();
    document.execCommand(name, false, value);
    emit();
  };
  const tools = [
    { label: "Negrito", icon: Bold, name: "bold" },
    { label: "Itálico", icon: Italic, name: "italic" },
    { label: "Título", icon: Heading2, name: "formatBlock", value: "h2" },
    { label: "Lista com marcadores", icon: List, name: "insertUnorderedList" },
    { label: "Lista numerada", icon: ListOrdered, name: "insertOrderedList" },
    { label: "Citação", icon: Quote, name: "formatBlock", value: "blockquote" },
    { label: "Limpar formatação", icon: Eraser, name: "removeFormat" },
  ];
  return <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
    <div className="overflow-hidden rounded-xl border border-input bg-white shadow-xs focus-within:border-[#a8864b] focus-within:ring-2 focus-within:ring-[#a8864b]/15">
      <div className="flex flex-wrap gap-0.5 border-b border-slate-200 bg-[#faf9f6] p-1.5" aria-label="Formatação do texto">
        {tools.map(({ label: toolLabel, icon: Icon, name, value }) => <Button key={toolLabel} type="button" size="icon-sm" variant="ghost" title={toolLabel} aria-label={toolLabel} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => command(name, value)}><Icon className="size-4" /></Button>)}
      </div>
      <div ref={editor} id={id} role="textbox" aria-label={label} aria-multiline="true" contentEditable={!disabled} data-placeholder={placeholder} suppressContentEditableWarning
        className="rich-text-editor min-h-36 px-4 py-3 text-base leading-7 text-slate-700 outline-none sm:text-sm"
        onInput={emit} onBlur={() => { if (editor.current) editor.current.innerHTML = sanitizeRichHtml(editor.current.innerHTML); emit(); }}
        onPaste={(event) => { event.preventDefault(); const html = event.clipboardData.getData("text/html"); const text = event.clipboardData.getData("text/plain"); insertHtml(html ? sanitizeRichHtml(html) : plainTextToRichHtml(text), event.currentTarget); emit(); }} />
    </div>
    <p className="mt-1.5 text-xs text-slate-500">Cole do ChatGPT, Word ou Google Docs. Títulos, negrito e listas são preservados.</p>
  </div>;
}

export function RichTextContent({ html, text, className = "" }: { html?: string; text: string; className?: string }) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!content.current) return;
    const safe = html ? sanitizeRichHtml(html) : "";
    if (safe) content.current.innerHTML = safe;
    else content.current.textContent = text;
  }, [html, text]);
  return <div ref={content} className={`rich-text-content whitespace-pre-wrap break-words ${className}`}>{text}</div>;
}
