"use client";

import { useState, useEffect } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
}

export default function CountUp({ end, duration = 1000 }: CountUpProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const endValue = Math.floor(end);
    if (isNaN(endValue) || endValue === 0) { setCount(0); return; }
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const fraction = Math.min(progress / duration, 1);
      const val = Math.floor(fraction * (2 - fraction) * endValue);
      setCount(val);
      if (progress < duration) requestAnimationFrame(animate);
      else setCount(endValue);
    };

    const frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [end, duration]);

  return <span>{count.toLocaleString("id-ID")}</span>;
}
