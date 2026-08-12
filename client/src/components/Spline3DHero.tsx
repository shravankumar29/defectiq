import { useState, Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Lazy load the Spline component to optimize initial page load performance
const Spline = lazy(() => import("@splinetool/react-spline"));

interface Spline3DHeroProps {
  sceneUrl?: string;
  className?: string;
  uploadState?: "idle" | "reading" | "mapping" | "analyzing" | "detected";
  isHovering?: boolean;
}

export default function Spline3DHero({
  sceneUrl = "https://prod.spline.design/dzwVweTh0XfFxn7p/scene.splinecode",
  className = "",
  uploadState = "idle",
  isHovering = false,
}: Spline3DHeroProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Status text mapping for the floating indicator
  const statusMap = {
    idle: "",
    reading: "READING FACTORY DATA",
    mapping: "MAPPING COLUMNS",
    analyzing: "ANALYZING PATTERNS",
    detected: "PATTERN DETECTED"
  };

  return (
    <div className={`relative w-[110%] -ml-[5%] md:w-[120%] md:-ml-[10%] h-full z-0 overflow-visible pointer-events-auto ${className}`}>
      <div 
        className={`w-full h-full flex items-center justify-center transition-all duration-700 ease-out translate-x-2 md:translate-x-6 lg:translate-x-10 -translate-y-2 md:-translate-y-6 lg:-translate-y-10 scale-[1.0] md:scale-[1.15] lg:scale-[1.18] ${isHovering ? "brightness-110 scale-[1.02] md:scale-[1.18] lg:scale-[1.21]" : "brightness-100"}`}
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 100%)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 100%)"
        }}
      >
        
        {/* Floating Upload Status Indicator */}
        {uploadState !== "idle" && (
          <div className="absolute left-[15%] top-[20%] z-20 lp-border-glow rounded-full bg-cyan-950/80 px-4 py-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2">
              {uploadState !== "detected" ? (
                <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              )}
              <span className="font-data text-[10px] uppercase tracking-[0.2em] text-cyan-200">
                {statusMap[uploadState]}
              </span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              <span className="font-data text-[10px] uppercase tracking-[0.2em] text-cyan-400/60">
                Initializing 3D Engine
              </span>
            </div>
          </div>
        )}

        {/* Error Fallback */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="font-data text-[10px] uppercase tracking-[0.2em] text-white/30">
              3D Visualization Unavailable
            </span>
          </div>
        )}

        {/* Spline Component */}
        {!hasError && (
          <Suspense fallback={null}>
            <Spline
              scene={sceneUrl}
              onLoad={() => setIsLoaded(true)}
              onError={(e) => {
                console.error("Spline load error:", e);
                setHasError(true);
              }}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                opacity: isLoaded ? 1 : 0,
                transition: "opacity 1s ease-in-out",
              }}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
