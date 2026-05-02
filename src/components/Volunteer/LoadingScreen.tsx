"use client";

import React from "react";

interface LoadingScreenProps {
  fullPage?: boolean;
}

export default function LoadingScreen({ fullPage = false }: LoadingScreenProps) {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: fullPage ? "70vh" : "200px",
    width: "100%",
  };

  const spinnerStyle: React.CSSProperties = {
    width: "40px",
    height: "40px",
    border: "3px solid #f3f3f3",
    borderTop: "3px solid #3b82f6",
    borderRadius: "50%",
    animation: "gsb-spin 1s linear infinite",
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes gsb-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={spinnerStyle} />
    </div>
  );
}
