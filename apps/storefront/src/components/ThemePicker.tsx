"use client";

import { useEffect, useState } from "react";
import { THEME_KEY, themes, type ThemeId } from "@/lib/themes";
import { whatsappLink } from "@/lib/site";

export function applyTheme(id: ThemeId) {
  if (id === "rose") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", id);
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    /* storage unavailable: theme still applies for this page */
  }
}

export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ThemeId>("rose");

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme") as ThemeId | null;
    setCurrent(t ?? "rose");
  }, []);

  const active = themes.find((t) => t.id === current) ?? themes[0];

  return (
    <div className="picker">
      {open && (
        <div className="picker-panel" role="dialog" aria-label="Choose a design">
          <b style={{ fontSize: 15 }}>Preview a design</b>
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              className="picker-option"
              aria-pressed={current === t.id}
              onClick={() => {
                applyTheme(t.id);
                setCurrent(t.id);
              }}
            >
              <span className="swatches" aria-hidden="true">
                {t.colors.map((c) => <span key={c} style={{ background: c }} />)}
              </span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <b style={{ fontSize: 14 }}>{t.name}</b>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.note}</span>
              </span>
            </button>
          ))}
          <a
            className="btn"
            style={{ minBlockSize: 46, fontSize: 14 }}
            href={whatsappLink(`My vote for the Insi House design: ${active.name}`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Vote for {active.name} on WhatsApp
          </a>
        </div>
      )}
      <button type="button" className="picker-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Design: {active.name}
      </button>
    </div>
  );
}
