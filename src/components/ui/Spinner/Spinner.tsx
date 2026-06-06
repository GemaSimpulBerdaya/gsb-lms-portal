import React from 'react';
import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

export default function Spinner({ size = 'md', className = '', style }: SpinnerProps) {
  return (
    <div 
      className={`${styles.spinner} ${styles[size]} ${className}`} 
      style={style} 
      role="status" 
      aria-label="Loading..."
    />
  );
}
