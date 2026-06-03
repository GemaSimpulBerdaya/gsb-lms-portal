"use client";

import React from "react";
import { formatDateID, getDayNameID } from "@/utils/formatters";

interface PageHeroProps {
  title: string;
  description: string;
  badge?: string;
  showDate?: boolean;
  variant?: "premium" | "clean";
}

export default function PageHero({ 
  title, 
  description, 
  badge = "Volunteer Portal", 
  showDate = false,
  variant = "clean"
}: PageHeroProps) {
  
  if (variant === "premium") {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '44px',
        background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
        padding: '40px',
        borderRadius: '24px',
        color: 'white',
        boxShadow: '0 20px 40px rgba(29, 78, 216, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '6px 14px',
            borderRadius: '100px',
            fontSize: '11px',
            fontWeight: 700,
            marginBottom: '16px',
            backdropFilter: 'blur(4px)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {badge}
          </span>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 800,
            color: 'white',
            letterSpacing: '-1.5px',
            margin: '0 0 12px 0',
            lineHeight: 1.1
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.9)',
            maxWidth: '550px',
            lineHeight: '1.6',
            margin: 0
          }}>
            {description}
          </p>
        </div>

        {showDate && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            padding: '20px 28px',
            borderRadius: '20px',
            backdropFilter: 'blur(10px)',
            textAlign: 'right',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            position: 'relative',
            zIndex: 2
          }}>
            <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.8, marginBottom: '4px' }}>
              {getDayNameID(new Date())}
            </span>
            <span style={{ display: 'block', fontSize: '18px', fontWeight: 700 }}>
              {formatDateID(new Date())}
            </span>
          </div>
        )}

        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          filter: 'blur(60px)',
          zIndex: 1
        }} />
      </div>
    );
  }

  // CLEAN VARIANT (Default for data pages)
  return (
    <div style={{
      marginBottom: '40px',
      paddingBottom: '32px',
      borderBottom: '1px solid #f1f5f9'
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: '#f8fafc',
        padding: '6px 12px',
        borderRadius: '8px',
        marginBottom: '16px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {badge}
        </span>
      </div>
      <h1 style={{
        fontSize: '32px',
        fontWeight: 800,
        color: '#111827',
        letterSpacing: '-1px',
        margin: '0 0 12px 0'
      }}>
        {title}
      </h1>
      <p style={{
        fontSize: '16px',
        color: '#64748b',
        maxWidth: '700px',
        lineHeight: '1.6',
        margin: 0
      }}>
        {description}
      </p>
    </div>
  );
}
