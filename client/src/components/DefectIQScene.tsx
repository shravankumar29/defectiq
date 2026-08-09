/**
 * DefectIQScene — reusable 3D environment component (PLACEHOLDER)
 *
 * The final 3D asset (WebGL / Three.js) will replace this component.
 * The landing page is designed AROUND this scene, so keep its public API
 * stable: the page only interacts via these props.
 *
 * Design requirements for the future asset:
 * - large, full-width, capable of extending beyond section boundaries
 * - transparent background compatible (page is near-black #040508)
 * - responsive; supports parallax and slow scroll-driven movement
 * - slow rotation, subtle floating, calm cinematic motion
 * - geometric cubes / structures, thin cyan-blue outlines, subtle violet
 *   highlights, floating data particles, glowing connections, highlighted nodes
 *
 * Behavior of the placeholder today: a drifting, faint constellation of
 * outlined cubes and particles that reacts to scroll progress — so the
 * page feels alive even before the real asset ships.
 */
import { useEffect, useRef, useState } from "react";

export interface DefectIQSceneProps {
  /** 0..1 overall scroll progress of the page, drives scene evolution */
  scrollProgress?: number;
  /** Extra vertical offset for per-section parallax */
  parallax?: number;
  /** Emphasize specific nodes (future: highlight cubes matching a pattern) */
  highlightedNodes?: string[];
  /** Allow the scene to bleed outside its container */
  bleed?: boolean;
  className?: string;
}

type Cube = {
  id: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
  speed: number;
  stroke: string;
  highlight: boolean;
};

const CUBES: Cube[] = [
  { id: "c1", x: 72, y: 18, size: 120, rotate: 12, speed: 0.6, stroke: "rgba(96,200,255,0.30)", highlight: false },
  { id: "c2", x: 24, y: 46, size: 64, rotate: -8, speed: 1.0, stroke: "rgba(140,130,255,0.22)", highlight: false },
  { id: "c3", x: 84, y: 52, size: 88, rotate: 20, speed: 0.8, stroke: "rgba(96,200,255,0.22)", highlight: true },
  { id: "c4", x: 46, y: 76, size: 52, rotate: -16, speed: 1.2, stroke: "rgba(96,200,255,0.18)", highlight: false },
  { id: "c5", x: 12, y: 78, size: 40, rotate: 6, speed: 1.4, stroke: "rgba(140,130,255,0.18)", highlight: false },
  { id: "c6", x: 60, y: 10, size: 46, rotate: 30, speed: 0.9, stroke: "rgba(140,130,255,0.24)", highlight: false },
  { id: "c7", x: 92, y: 80, size: 36, rotate: -24, speed: 1.1, stroke: "rgba(96,200,255,0.16)", highlight: false },
];

type Particle = { id: number; x: number; y: number; r: number; delay: number; dur: number; vx: number; vy: number };

function buildParticles(n: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: Math.random() * 1.6 + 0.4,
      delay: Math.random() * 8,
      dur: 12 + Math.random() * 16,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
    });
  }
  return out;
}

function driftStyle(p: Particle): React.CSSProperties {
  return {
    left: `${p.x}%`,
    top: `${p.y}%`,
    animationDuration: `${p.dur}s`,
    animationDelay: `-${p.delay}s`,
    width: p.r * 2,
    height: p.r * 2,
    borderRadius: "50%",
    background:
      p.id % 5 === 0
        ? "rgba(150,140,255,0.55)"
        : "rgba(110,205,255,0.5)",
    boxShadow: `0 0 ${p.r * 3}px ${p.id % 5 === 0 ? "rgba(150,140,255,0.35)" : "rgba(110,205,255,0.35)"}`,
    animation: `lp-drift ${p.dur}s ease-in-out ${p.delay}s infinite`,
  };
}

export default function DefectIQScene({
  scrollProgress = 0,
  parallax = 0,
  highlightedNodes = [],
  bleed = false,
  className = "",
}: DefectIQSceneProps) {
  const [particles] = useState(() => buildParticles(46));
  const ref = useRef<HTMLDivElement>(null);

  // Gentle autonomous rotation of cubes.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTick(t => t + 1), 60);
    return () => clearInterval(id);
  }, []);

  const sp = Math.min(1, Math.max(0, scrollProgress));

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${bleed ? "-inset-[20%]" : ""} ${className}`}
    >
      {/* atmospheric glow */}
      <div
        className="absolute left-1/2 top-[18%] h-[70vh] w-[90vw] -translate-x-1/2 rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(60,140,220,0.10) 0%, rgba(110,100,220,0.05) 45%, transparent 72%)",
        }}
      />

      {/* faint technical grid */}
      <div className="landing-grid-bg absolute inset-0" />

      {/* particle field */}
      {particles.map(p => (
        <div key={p.id} className="absolute" style={driftStyle(p)} />
      ))}

      {/* cube constellation — scroll progress evolves the scene */}
      {CUBES.map((c, i) => {
        const drift = tick * 0.04 * c.speed;
        const yShift = parallax * 120 * (0.4 + i * 0.12) + sp * 60 * Math.sin(i + 1);
        const xShift = sp * 30 * Math.cos(i * 1.7) + Math.sin(drift * 0.02) * 6;
        const scale = 1 + sp * 0.12 * Math.sin(i * 2.3);
        const isHL = highlightedNodes.includes(c.id) || c.highlight && sp > 0.55;
        return (
          <div
            key={c.id}
            className="absolute"
            style={{
              left: `${c.x + xShift}%`,
              top: `${c.y + yShift}%`,
              width: c.size * scale,
              height: c.size * scale,
              transform: `rotate(${c.rotate + drift * 0.08}deg) translateZ(0)`,
              opacity: 0.35 + sp * 0.35,
              transition: "opacity 1.2s cubic-bezier(0.23,1,0.32,1)",
            }}
          >
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <rect
                x="14" y="14" width="72" height="72"
                fill="rgba(8,10,16,0.55)"
                stroke={isHL ? "rgba(120,210,255,0.85)" : c.stroke}
                strokeWidth={isHL ? 1.6 : 0.8}
              />
              <rect
                x="26" y="26" width="48" height="48"
                fill="none"
                stroke={isHL ? "rgba(170,150,255,0.7)" : "rgba(140,130,255,0.22)"}
                strokeWidth="0.6"
              />
              {isHL && (
                <circle cx="50" cy="50" r="4" fill="rgba(120,210,255,0.9)">
                  <animate attributeName="r" values="3;6;3" dur="3s" repeatCount="indefinite" />
                </circle>
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
