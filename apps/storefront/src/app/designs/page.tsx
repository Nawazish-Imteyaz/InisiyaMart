import type { Metadata } from "next";
import { themes } from "@/lib/themes";

export const metadata: Metadata = { title: "Choose our design" };

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function DesignsPage() {
  return (
    <div className="container section">
      <span className="eyebrow">Family preview</span>
      <h1 className="display" style={{ fontSize: "clamp(38px, 5vw, 56px)", marginBlock: "10px 12px" }}>Help us choose the Insi House design</h1>
      <p className="muted" style={{ fontSize: 17, lineHeight: 1.7, maxInlineSize: 720, marginBlockEnd: 36 }}>
        Open each design, browse the whole website on your phone (home, shop, product pages and our story), then send your vote with the
        <b> Design</b> button at the bottom-left of every page.
      </p>
      <div className="grid">
        {themes.map((t, i) => (
          <div key={t.id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 22, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", blockSize: 120 }}>
              {t.colors.map((c) => <span key={c} style={{ flex: 1, background: c }} />)}
            </div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 8, flexGrow: 1 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Design {i + 1}</span>
              <h2 className="display" style={{ fontSize: 30 }}>{t.name}</h2>
              <span className="muted">{t.note}</span>
              <div style={{ flexGrow: 1 }} />
              {/* Full page load (not <Link>) so the theme script applies the chosen design. */}
              <a className="btn" href={`${base}/?theme=${t.id}`}>View website in this design</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
