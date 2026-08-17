import { useEffect, useRef, useState } from "react";

/**
 * Tracks window scroll position, throttled to animation frames so this
 * doesn't fire a state update on every single scroll event — smooth
 * parallax without hammering React's render loop.
 */
export function useScrollY(): number {
  const [scrollY, setScrollY] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return scrollY;
}

/**
 * True once the element has scrolled into view — stays true afterward
 * (a one-way reveal, not a toggle on every scroll back and forth, which
 * reads as flickery rather than a deliberate entrance).
 */
export function useRevealOnScroll<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}
