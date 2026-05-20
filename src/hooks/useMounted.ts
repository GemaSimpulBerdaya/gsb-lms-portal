import { useEffect, useState } from 'react';

/**
 * Hook to track component mount state for SSR guard pattern.
 * Returns true after component mounts on client side.
 * 
 * @returns {boolean} mounted - true after component mounts, false during SSR
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  return mounted;
}
