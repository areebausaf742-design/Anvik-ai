"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Stars } from "@react-three/drei";
import { motion } from "framer-motion";
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { Mesh } from "three";

function Core() {
  const core = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (core.current) core.current.rotation.y += delta * 0.16;
    if (halo.current) halo.current.rotation.z += delta * 0.08;
  });
  return (
    <Float speed={1.1} rotationIntensity={0.2} floatIntensity={0.28}>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.04, 5]} />
        <MeshDistortMaterial color="#7047ff" emissive="#4b18b8" emissiveIntensity={1.2} roughness={0.16} metalness={0.48} distort={0.36} speed={1.5} />
      </mesh>
      <mesh ref={halo} scale={1.31}>
        <torusGeometry args={[1, 0.006, 12, 180]} />
        <meshBasicMaterial color="#48e9ff" transparent opacity={0.68} />
      </mesh>
      <mesh rotation={[1.1, 0.25, 0.2]} scale={1.46}>
        <torusGeometry args={[1, 0.003, 8, 160]} />
        <meshBasicMaterial color="#f74fae" transparent opacity={0.48} />
      </mesh>
      <pointLight color="#7047ff" intensity={22} distance={5} />
      <pointLight color="#00ddff" intensity={5} distance={4} position={[1.6, -0.8, 1.2]} />
    </Float>
  );
}

class OrbBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function OrbFallback() {
  return <div className="orb-fallback" aria-hidden="true"><span className="fallback-ring fallback-ring-a"/><span className="fallback-ring fallback-ring-b"/><span className="fallback-core"><i/><i/><i/></span></div>;
}

export default function Orb({ size = "large", active = false }: { size?: "large" | "small"; active?: boolean }) {
  const [webglAvailable, setWebglAvailable] = useState(false);
  useEffect(() => {
    const testCanvas = document.createElement("canvas");
    const context = testCanvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) || testCanvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    setWebglAvailable(Boolean(context));
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }, []);
  return (
    <motion.div className={`orb-wrap orb-${size}${active ? " orb-active" : ""}`} animate={active ? { scale: [1, 1.055, 1] } : undefined} transition={{ duration: 1.3, repeat: active ? Infinity : 0 }} aria-label="A luminous, living violet and cyan AI orb" role="img">
      {webglAvailable ? <OrbBoundary fallback={<OrbFallback />}>
        <Canvas dpr={[1, 1.4]} camera={{ position: [0, 0, 4.1], fov: 42 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.7} />
          <Suspense fallback={null}><Stars radius={32} depth={24} count={size === "large" ? 160 : 48} factor={2.6} saturation={0.4} fade speed={0.28} /><Core /></Suspense>
        </Canvas>
      </OrbBoundary> : <OrbFallback />}
    </motion.div>
  );
}
