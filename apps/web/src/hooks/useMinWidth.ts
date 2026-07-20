import { useEffect, useState } from 'react';

/** True when the viewport is at least `minWidth` CSS pixels. Updates on resize. */
export function useMinWidth(minWidth: number) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= minWidth;
  });

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${minWidth}px)`);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [minWidth]);

  return matches;
}
