import React, { useEffect, useState, useRef } from "react";

interface FloatingButtonProps {
  loading: boolean;
  active: boolean;
  compact?: boolean;
  promptState?: "idle" | "vague" | "ready";
  onClick: () => void;
  onDoubleClick: () => void;
  success?: boolean;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({ 
  loading, 
  active, 
  compact, 
  promptState = "idle", 
  onClick, 
  onDoubleClick, 
  success 
}) => {
  const [showSuccessRing, setShowSuccessRing] = useState(false);
  const clickTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (success) {
      setShowSuccessRing(true);
      const timer = setTimeout(() => setShowSuccessRing(false), 800);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleClicks = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (clickTimeoutRef.current !== null) {
      // Double click detected!
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onDoubleClick();
    } else {
      // Start standard single click timer window (300ms — more forgiving on slower devices)
      clickTimeoutRef.current = window.setTimeout(() => {
        clickTimeoutRef.current = null;
        onClick();
      }, 300);
    }
  };

  const stateClass = promptState === "vague" ? "pulse-vague" : promptState === "ready" ? "glow-ready" : "";
  
  // FIX 4.15: Don't unmount the entire button when the orb image can't be loaded.
  // If the extension context is invalidated, show a text fallback so the user
  // can still click to open the panel.
  let imageContent: React.ReactNode;
  try {
    const imageUrl = chrome.runtime.getURL("public/promptly-orb.png");
    imageContent = (
      <img
        src={imageUrl}
        alt="Proenpt Orb"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "50%",
          transform: active ? "scale(0.95)" : "scale(1.1)",
          transition: "transform 0.2s ease",
          zIndex: 2,
          pointerEvents: "none"
        }}
      />
    );
  } catch (e) {
    // Extension context invalidated — show text fallback instead of unmounting.
    imageContent = (
      <span style={{ fontSize: 16, lineHeight: 1, pointerEvents: "none", zIndex: 2 }}>✦</span>
    );
  }

  return (
    <button
      type="button"
      aria-label="Optimize prompt with Proenpt"
      title="Single-click to open panel | Double-click to Auto-Optimize"
      onClick={handleClicks}
      onMouseDown={(e) => e.preventDefault()}
      className={`promptly-orb ${compact ? 'compact' : ''} ${loading ? "promptly-loading" : ""} ${active ? "promptly-orb-active" : ""} ${!active && stateClass ? stateClass : ""}`}
    >
      <div className="promptly-loading-ring active" />
      {imageContent}
      {showSuccessRing && <div className="promptly-success-ring" />}
    </button>
  );
};
