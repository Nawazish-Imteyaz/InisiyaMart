"use client";

import { useEffect, useState } from "react";

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="adm-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="adm-muted">{sub}</p>}
      </div>
      {actions && <div className="adm-head-actions">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`adm-field${wide ? " wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Loading() {
  return <div className="adm-center"><span className="adm-spinner" aria-label="Loading" /></div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="adm-empty">{children}</div>;
}

/** Simple promise-based loader with reload(). */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    fn().then((d) => alive && setData(d)).catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load"));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((t) => t + 1), setData };
}

export function ErrorBox({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="adm-error">
      {text} {retry && <button className="adm-btn small" onClick={retry}>Try again</button>}
    </div>
  );
}

export function ColorDots<T extends string>({ options, value, onChange, name }: {
  options: readonly { value: T; label: string; css: string }[]; value: T; onChange: (v: T) => void; name: string;
}) {
  return (
    <div className="adm-swatches" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.label}
          className={`adm-swatch${value === o.value ? " on" : ""}`}
          style={{ background: o.css }}
          onClick={() => onChange(o.value)}
        >
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
