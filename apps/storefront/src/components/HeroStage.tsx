"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ProductArt } from "./ProductArt";

const Hero3D = dynamic(() => import("./Hero3D"), { ssr: false, loading: () => <Fallback /> });

function Fallback() {
  return (
    <div className="stage-fallback">
      <ProductArt art="pot" size={220} light />
    </div>
  );
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Arch-shaped stage that shows the 3D scene when WebGL is available, else an illustration. */
export function HeroStage() {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => setWebgl(hasWebGL()), []);

  return (
    <div className="hero-stage">
      <div className="stage-arch arch">
        {webgl ? <Hero3D /> : <Fallback />}
        <div className="rings arch" aria-hidden="true" />
      </div>
      <div className="chip-float chip-a float">
        <span className="muted">Handmade in</span>
        <b>Azamgarh, UP</b>
      </div>
      <div className="chip-float chip-b float">
        <span className="muted">Gift-wrapped with</span>
        <b>your message ♡</b>
      </div>
    </div>
  );
}
