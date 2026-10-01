"use client";

import { cloneElement, isValidElement, useId } from "react";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>{isValidElement(children) ? cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children}</div>;
}

