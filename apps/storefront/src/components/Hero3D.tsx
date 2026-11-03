"use client";

// 3D hero: a glossy Nizamabad-style black pottery surahi with silver & gold bands,
// a floating plum gift box and festive sparkles. Loaded lazily by HeroStage.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Surahi({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const profile = useMemo(
    () =>
      [
        [0, 0], [0.42, 0.01], [0.6, 0.12], [0.76, 0.4], [0.8, 0.68], [0.72, 0.96], [0.5, 1.18],
        [0.26, 1.36], [0.18, 1.56], [0.17, 1.92], [0.25, 2.02], [0.22, 2.08], [0.15, 2.06],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
    [],
  );
  const dots = useMemo(() => Array.from({ length: 28 }, (_, i) => (i / 28) * Math.PI * 2), []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    if (animate) g.rotation.y += dt * 0.45;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, state.pointer.y * 0.15, 0.05);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, -state.pointer.x * 0.08, 0.05);
  });

  return (
    <group ref={group} position={[-0.35, -1.2, 0]}>
      <mesh>
        <latheGeometry args={[profile, 128]} />
        <meshPhysicalMaterial color="#120c10" roughness={0.16} metalness={0.15} clearcoat={1} clearcoatRoughness={0.06} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.68, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.808, 0.016, 16, 160]} />
        <meshStandardMaterial color="#e6e3ea" metalness={1} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.772, 0.014, 16, 160]} />
        <meshStandardMaterial color="#d9b25a" metalness={1} roughness={0.25} />
      </mesh>
      {dots.map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.8, 0.55, Math.sin(a) * 0.8]} rotation={[0, -a, Math.PI / 4]}>
          <octahedronGeometry args={[0.035, 0]} />
          <meshStandardMaterial color="#e6e3ea" metalness={1} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 2.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.025, 16, 64]} />
        <meshStandardMaterial color="#d9b25a" metalness={1} roughness={0.25} />
      </mesh>
    </group>
  );
}

function GiftBox({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.position.y = -0.55 + (animate ? Math.sin(t * 1.4) * 0.12 : 0);
    if (animate) g.rotation.y = -0.6 + Math.sin(t * 0.6) * 0.35;
  });
  const gold = <meshStandardMaterial color="#d9b25a" metalness={0.9} roughness={0.25} />;
  return (
    <group ref={ref} position={[1.05, -0.55, 0.5]} rotation={[0.25, -0.6, 0.08]} scale={0.62}>
      <mesh>
        <boxGeometry args={[1, 0.8, 1]} />
        <meshPhysicalMaterial color="#7a2650" roughness={0.35} clearcoat={0.6} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.08, 0.18, 1.08]} />
        <meshPhysicalMaterial color="#8f3360" roughness={0.3} clearcoat={0.6} />
      </mesh>
      <mesh><boxGeometry args={[0.16, 0.99, 1.1]} />{gold}</mesh>
      <mesh><boxGeometry args={[1.1, 0.99, 0.16]} />{gold}</mesh>
      <mesh position={[-0.17, 0.62, 0]} rotation={[0, 0, 0.6]}><torusGeometry args={[0.16, 0.05, 12, 32]} />{gold}</mesh>
      <mesh position={[0.17, 0.62, 0]} rotation={[0, 0, -0.6]}><torusGeometry args={[0.16, 0.05, 12, 32]} />{gold}</mesh>
    </group>
  );
}

function Sparkles({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const colors = ["#F4A63A", "#E0457B", "#FFC857", "#B89BD9", "#ffffff"];
    return Array.from({ length: 26 }, (_, i) => ({
      pos: [(Math.random() - 0.5) * 4.2, (Math.random() - 0.3) * 3.2, (Math.random() - 0.5) * 1.6] as [number, number, number],
      color: colors[i % colors.length],
      s: 0.025 + Math.random() * 0.04,
    }));
  }, []);
  useFrame((_, dt) => {
    if (animate && ref.current) ref.current.rotation.y += dt * 0.08;
  });
  return (
    <group ref={ref}>
      {items.map((it, i) => (
        <mesh key={i} position={it.pos}>
          <sphereGeometry args={[it.s, 12, 12]} />
          <meshBasicMaterial color={it.color} />
        </mesh>
      ))}
    </group>
  );
}

export default function Hero3D() {
  const animate = typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.25, 4.6], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={animate ? "always" : "demand"}
      aria-hidden="true"
    >
      <Environment />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} />
      <pointLight position={[-3, 1.5, 2]} intensity={14} color="#E0457B" />
      <pointLight position={[3, -1, 2.5]} intensity={10} color="#F4A63A" />
      <Surahi animate={animate} />
      <GiftBox animate={animate} />
      <Sparkles animate={animate} />
    </Canvas>
  );
}
