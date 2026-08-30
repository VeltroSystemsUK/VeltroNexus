import { useEffect, useState, type ReactNode } from 'react';
import { StatusBar } from './StatusBar';

export function LiveStatusBar({
  getZoom,
  subscribe,
  onZoomOut,
  onZoomIn,
  onReset,
  trailing,
}: {
  getZoom: () => number;
  subscribe: (onChange: () => void) => () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
  trailing?: ReactNode;
}) {
  const [zoom, setZoom] = useState(getZoom);
  useEffect(() => {
    let raf = 0;
    return subscribe(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setZoom(getZoom());
      });
    });
  }, [getZoom, subscribe]);
  return (
    <StatusBar
      zoom={zoom}
      onZoomOut={onZoomOut}
      onZoomIn={onZoomIn}
      onReset={onReset}
      trailing={trailing}
    />
  );
}
