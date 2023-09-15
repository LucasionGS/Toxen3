import React, { useEffect, useRef, useState } from 'react';

export interface DragScrollContainerProps extends React.HTMLProps<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * A container that allows you to scroll by dragging the mouse.
 */
export function DragScrollContainer(props: DragScrollContainerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setScrollTop(containerRef.current?.scrollTop ?? 0);
    console.log("mousedown");
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const delta = e.clientY - startY;
    containerRef.current!.scrollTop = scrollTop - delta;
    console.log("mousemove");
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    console.log("mouseup");
  };

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      {...props} />
  );
}
