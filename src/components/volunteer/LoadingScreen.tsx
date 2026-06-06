"use client";

import React from "react";
import Spinner from "@/components/ui/Spinner/Spinner";

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

  return (
    <div style={containerStyle}>
      <Spinner />
    </div>
  );
}
