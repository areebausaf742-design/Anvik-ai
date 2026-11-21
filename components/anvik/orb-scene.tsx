"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import { useRef } from "react";
import type { Mesh } from "three";

/**
 * The Three.js half of the orb, split into its own chunk so pages that never
 * show an orb do not pay for WebGL (audit M-3).
 *
 * Deliberately cheap: detail 3 instead of 5, two rings instead of a starfield,
 * no post-processing, dpr capped. It is a small mark, not a screensaver.
 */

function Sphere({ active }: { active: boolean }) {
  const core = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (core.current) core.current.rotation.y += delta * (active ? 0.22 : 0.1);
    if (ring.current) ring.current.rotation.z += delta * 0.06;
  });

  return (
    <Float speed={0.7} rotationIntensity={0.12} floatIntensity={0.16}>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.02, 3]} />
        <MeshDistortMaterial
          color="#2f6b56"
          emissive="#123a2e"
          emissiveIntensity={0.35}
          roughness={0.34}
          metalness={0.18}
          distort={active ? 0.3 : 0.2}
          speed={1.1}
        />
      </mesh>
      <mesh ref={ring} scale={1.32}>
        <torusGeometry args={[1, 0.004, 8, 128]} />
        <meshBasicMaterial color="#1f5f4b" transparent opacity={0.34} />
      </mesh>
      <mesh rotation={[1.15, 0.3, 0.2]} scale={1.52}>
        <torusGeometry args={[1, 0.0025, 6, 96]} />
        <meshBasicMaterial color="#8a8577" transparent opacity={0.22} />
      </mesh>
      <pointLight color="#ffffff" intensity={9} distance={6} position={[2, 2.4, 3]} />
      <pointLight color="#4e8f77" intensity={3} distance={5} position={[-2, -1.4, 1]} />
    </Float>
  );
}

export default function OrbScene({ count = 48, active = false }: { count?: number; active?: boolean }) {
  void count;
  return (
    <Canvas
      dpr={[1, 1.35]}
      camera={{ position: [0, 0, 4.2], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      frameloop="always"
    >
      <ambientLight intensity={0.85} />
      <Sphere active={active} />
    </Canvas>
  );
}
