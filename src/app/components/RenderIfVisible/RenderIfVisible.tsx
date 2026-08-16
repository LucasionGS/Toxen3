import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Simple IntersectionObserver-based list virtualization: children are only
 * mounted while the wrapper is near the viewport, and are swapped for a
 * fixed-height placeholder otherwise.
 *
 * This is a local port of `react-render-if-visible` (Apache-2.0, NightCafe
 * Studio). That package is unmaintained and declares `react < 19` as a peer,
 * which blocks the React 19 upgrade. The behaviour here is deliberately
 * identical to the original — including the idle-callback deferral and the
 * measure-before-hiding order, both of which matter for scroll stability.
 */
export interface RenderIfVisibleProps {
  /** Whether the element should be visible initially or not. */
  initialVisible?: boolean;
  /** An estimate of the element's height, used by the placeholder. */
  defaultHeight?: number;
  /** How far outside the viewport, in pixels, counts as visible. */
  visibleOffset?: number;
  /** Keep children mounted once they have been visible at least once. */
  stayRendered?: boolean;
  root?: HTMLElement | null;
  rootElementClass?: string;
  placeholderElementClass?: string;
  children: React.ReactNode;
}

export default function RenderIfVisible({
  initialVisible = false,
  defaultHeight = 300,
  visibleOffset = 1000,
  stayRendered = false,
  root = null,
  rootElementClass = "",
  placeholderElementClass = "",
  children,
}: RenderIfVisibleProps) {
  const [isVisible, setIsVisible] = useState(initialVisible);
  const wasVisible = useRef(initialVisible);
  const placeholderHeight = useRef(defaultHeight);
  const intersectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const localRef = intersectionRef.current;
    if (!localRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Capture the rendered height before hiding, so the placeholder that
        // replaces the children does not change the scroll height.
        if (!entries[0].isIntersecting) {
          placeholderHeight.current = localRef.offsetHeight;
        }
        if (typeof window !== "undefined" && window.requestIdleCallback) {
          window.requestIdleCallback(() => setIsVisible(entries[0].isIntersecting), {
            timeout: 600,
          });
        } else {
          setIsVisible(entries[0].isIntersecting);
        }
      },
      { root, rootMargin: `${visibleOffset}px 0px ${visibleOffset}px 0px` }
    );

    observer.observe(localRef);
    return () => observer.unobserve(localRef);
    // Matches the original: observe once on mount and never re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isVisible) wasVisible.current = true;
  }, [isVisible]);

  const rootClasses = useMemo(() => `renderIfVisible ${rootElementClass}`, [rootElementClass]);
  const placeholderClasses = useMemo(
    () => `renderIfVisible-placeholder ${placeholderElementClass}`,
    [placeholderElementClass]
  );

  return (
    <div ref={intersectionRef} className={rootClasses}>
      {isVisible || (stayRendered && wasVisible.current) ? (
        <>{children}</>
      ) : (
        <div className={placeholderClasses} style={{ height: placeholderHeight.current }} />
      )}
    </div>
  );
}
