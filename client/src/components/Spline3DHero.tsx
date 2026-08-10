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
    <div className={`absolute inset-0 z-0 overflow-hidden pointer-events-auto ${className}`}>
      {/* 
        Responsive layout for the 3D element:
        - Mobile: Full width, positioned towards the bottom.
        - Tablet: 80% width, aligned right.
        - Desktop: 60% width, right-aligned, centered vertically.
        The container has a mask-image to create a smooth fade at the bottom.
      */}
      <div 
        className={`absolute w-full h-[60vh] bottom-0 left-0 md:w-[80%] md:h-[80vh] md:top-[10vh] md:left-auto md:right-[-5%] lg:w-[60%] lg:h-[90vh] lg:top-[5vh] lg:right-[2%] flex items-center justify-center transition-all duration-700 ease-out ${isHovering ? "scale-[1.02] brightness-110" : "scale-100 brightness-100"}`}
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%)"
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
