"use client";

import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function InstantFilterForm({
  action,
  className,
  children,
}: {
  action: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const navigateFromForm = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const sp = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      const str = String(v).trim();
      if (str && k !== "page") sp.set(k, str);
    }
    const qs = sp.toString();
    router.push(qs ? `${action}?${qs}` : action);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigateFromForm(e.currentTarget);
  };

  const onChange = (e: FormEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName.toLowerCase();
    const inputType = (target as HTMLInputElement).type?.toLowerCase();
    // Immediately apply whenever any <select>, checkbox, or radio changes — while keeping <input type="text"> focused!
    if (tag === "select" || inputType === "checkbox" || inputType === "radio") {
      navigateFromForm(e.currentTarget);
    }
  };

  return (
    <form action={action} method="get" onSubmit={onSubmit} onChange={onChange} className={className}>
      {children}
    </form>
  );
}
