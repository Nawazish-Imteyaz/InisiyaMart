import Link from "next/link";
import { categoryGradients, occasionLink, type Occasion } from "@/data/catalog";

const W = { fill: "none", stroke: "#fff", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Small hand-drawn motif for each occasion (marigold for haldi, paisley for mehndi, crescent for Eid…). */
export function OccasionArt({ slug, size = 72 }: { slug: string; size?: number }) {
  let d: React.ReactNode;
  if (slug === "haldi") {
    d = <>{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <ellipse key={a} cx="32" cy="17" rx="6" ry="11" transform={`rotate(${a} 32 32)`} {...W} fill="rgba(255,255,255,.18)" />)}<circle cx="32" cy="32" r="7" fill="#fff" /></>;
  } else if (slug === "mehndi") {
    d = <><path d="M22 50c-8-10-6-26 8-32 12-5 22 5 18 15-3 8-13 9-16 3-2-4 2-8 6-6" {...W} /><circle cx="44" cy="46" r="3" fill="#fff" /><circle cx="50" cy="38" r="2" fill="#fff" /><path d="M14 22c4 2 6 6 6 10" {...W} /></>;
  } else if (slug === "wedding-nikah") {
    d = <><circle cx="25" cy="38" r="12" {...W} /><circle cx="39" cy="38" r="12" {...W} /><path d="M39 18l4-6h-8z" fill="#fff" /></>;
  } else if (slug === "eid") {
    d = <><path d="M40 12a20 20 0 1 0 12 32A16 16 0 0 1 40 12z" fill="#fff" /><path d="M47 18l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z" fill="#fff" /></>;
  } else if (slug === "diwali") {
    d = <><path d="M14 38h36c-2 9-9 14-18 14s-16-5-18-14z" fill="#fff" /><path d="M32 34c-5-5-3-12 0-18 3 6 5 13 0 18z" fill="#fff" opacity=".85" /></>;
  } else if (slug === "housewarming") {
    d = <><path d="M12 32L32 14l20 18" {...W} /><path d="M18 28v22h28V28" {...W} /><path d="M28 50V38h8v12" {...W} /></>;
  } else if (slug === "birthday") {
    d = <><rect x="14" y="32" width="36" height="18" rx="4" {...W} /><path d="M14 40c6 4 12-4 18 0s12-4 18 0" {...W} /><path d="M32 26v-6" {...W} /><path d="M32 14c-2 2-2 4 0 6 2-2 2-4 0-6z" fill="#fff" /></>;
  } else if (slug === "anniversary" || slug === "mothers-day" || slug === "raksha-bandhan") {
    d = <path d="M32 50s-17-10-17-23a9 9 0 0 1 17-5 9 9 0 0 1 17 5c0 13-17 23-17 23z" fill="#fff" />;
  } else {
    d = <><rect x="14" y="28" width="36" height="24" rx="4" fill="rgba(255,255,255,.9)" /><rect x="10" y="20" width="44" height="10" rx="3" fill="#fff" /><path d="M32 20c-4-8-14-8-12-1 1 3 8 2 12 1zM32 20c4-8 14-8 12-1-1 3-8 2-12 1z" fill="#fff" /></>;
  }
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">{d}</svg>;
}

export function OccasionTile({ o, count }: { o: Occasion; count?: number }) {
  return (
    <Link href={occasionLink(o.slug)} className="occasion">
      <span
        className={`o-art arch${o.image ? " has-photo" : ""}`}
        style={{ background: o.image ? `linear-gradient(180deg, transparent 45%, rgba(43,27,34,.55)), url(${o.image}) center/cover` : categoryGradients[o.color] }}
      >
        {!o.image && <span className="o-motif"><OccasionArt slug={o.slug} /></span>}
        {o.urdu && <span className="urdu o-urdu" lang="ur" dir="rtl">{o.urdu}</span>}
      </span>
      <span className="o-name">{o.name}</span>
      {count !== undefined && <span className="o-count">{count ? `${count} gift${count === 1 ? "" : "s"}` : "Made to order"}</span>}
    </Link>
  );
}
