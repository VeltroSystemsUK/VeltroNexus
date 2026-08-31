import type { ShapeVariant } from "../lib/types";

const stroke = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.6 };

export function FrameGlyph({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      {id === "round" ? <ellipse cx="12" cy="12" rx="7.5" ry="7.5" {...stroke} /> : null}
      {id === "arch" ? <path d="M5 20 V12 A7 7 0 0 1 19 12 V20 Z" {...stroke} /> : null}
      {id === "diamond" ? <path d="M12 3.5 L20.5 12 L12 20.5 L3.5 12 Z" {...stroke} /> : null}
      {id === "hex" ? <path d="M12 3.5 L19.5 8 V16 L12 20.5 L4.5 16 V8 Z" {...stroke} /> : null}
      {id === "polaroid" ? <rect x="5" y="3.5" width="14" height="17" rx="1.2" {...stroke} /> : null}
      {id === "ticket" ? (
        <path d="M4.5 6.5 H19.5 V10.2 A1.8 1.8 0 0 0 19.5 13.8 V17.5 H4.5 V13.8 A1.8 1.8 0 0 0 4.5 10.2 Z" {...stroke} />
      ) : null}
      {id === "star" ? (
        <path d="M12 3.5 L14.2 9.2 L20.5 9.5 L15.6 13.4 L17.4 19.5 L12 16.2 L6.6 19.5 L8.4 13.4 L3.5 9.5 L9.8 9.2 Z" {...stroke} />
      ) : null}
      {id === "triangle" ? <path d="M12 4.5 L20 19.5 H4 Z" {...stroke} /> : null}
      {id === "heart" ? (
        <path d="M12 19.5 C12 19.5 4.5 14 4.5 9.5 A3.8 3.8 0 0 1 12 8.2 A3.8 3.8 0 0 1 19.5 9.5 C19.5 14 12 19.5 12 19.5 Z" {...stroke} />
      ) : null}
      {id === "speech" ? (
        <path d="M5 5.5 H19 A1.5 1.5 0 0 1 20.5 7 V14 A1.5 1.5 0 0 1 19 15.5 H11 L7 19.5 V15.5 H5 A1.5 1.5 0 0 1 3.5 14 V7 A1.5 1.5 0 0 1 5 5.5 Z" {...stroke} />
      ) : null}
      {id === "banner" ? <path d="M4.5 5.5 H19.5 V16.5 L12 19.5 L4.5 16.5 Z" {...stroke} /> : null}
      {id === "cloud" ? (
        <path d="M7.5 16.5 H17.2 A3.2 3.2 0 0 0 17.5 10.2 A4 4 0 0 0 10.2 9.4 A3.2 3.2 0 0 0 7.5 16.5 Z" {...stroke} />
      ) : null}
      {id === "chevron" ? <path d="M5 5.5 H15 L20 12 L15 18.5 H5 L10 12 Z" {...stroke} /> : null}
      {id === "plain" || !["round", "arch", "diamond", "hex", "polaroid", "ticket", "star", "triangle", "heart", "speech", "banner", "cloud", "chevron"].includes(id) ? (
        <rect x="4.5" y="5.5" width="15" height="13" rx="1.2" {...stroke} />
      ) : null}
    </svg>
  );
}

export function ShapeGlyph({ id }: { id: ShapeVariant }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      {id === "rect" ? <rect x="4.5" y="6" width="15" height="12" {...stroke} /> : null}
      {id === "rounded-rect" ? <rect x="4.5" y="6" width="15" height="12" rx="3" {...stroke} /> : null}
      {id === "ellipse" ? <ellipse cx="12" cy="12" rx="8" ry="6" {...stroke} /> : null}
      {id === "line" ? <path d="M4 12 H20" {...stroke} /> : null}
      {id === "triangle" ? <path d="M12 4.5 L20 19.5 H4 Z" {...stroke} /> : null}
      {id === "diamond" ? <path d="M12 3.5 L20.5 12 L12 20.5 L3.5 12 Z" {...stroke} /> : null}
      {id === "star" ? (
        <path d="M12 3.5 L14.2 9.2 L20.5 9.5 L15.6 13.4 L17.4 19.5 L12 16.2 L6.6 19.5 L8.4 13.4 L3.5 9.5 L9.8 9.2 Z" {...stroke} />
      ) : null}
      {id === "arrow" ? <path d="M5 12 H16 M12 6 L19 12 L12 18" {...stroke} /> : null}
      {id === "hexagon" ? <path d="M12 3.5 L19.5 8 V16 L12 20.5 L4.5 16 V8 Z" {...stroke} /> : null}
      {id === "pentagon" ? <path d="M12 3.5 L20.2 9.6 L17 19.5 H7 L3.8 9.6 Z" {...stroke} /> : null}
      {id === "octagon" ? <path d="M8.2 4.5 H15.8 L19.5 8.2 V15.8 L15.8 19.5 H8.2 L4.5 15.8 V8.2 Z" {...stroke} /> : null}
      {id === "chevron" ? <path d="M5 5.5 H15 L20 12 L15 18.5 H5 L10 12 Z" {...stroke} /> : null}
      {id === "heart" ? (
        <path d="M12 19.5 C12 19.5 4.5 14 4.5 9.5 A3.8 3.8 0 0 1 12 8.2 A3.8 3.8 0 0 1 19.5 9.5 C19.5 14 12 19.5 12 19.5 Z" {...stroke} />
      ) : null}
      {id === "speech" ? (
        <path d="M5 5.5 H19 A1.5 1.5 0 0 1 20.5 7 V14 A1.5 1.5 0 0 1 19 15.5 H11 L7 19.5 V15.5 H5 A1.5 1.5 0 0 1 3.5 14 V7 A1.5 1.5 0 0 1 5 5.5 Z" {...stroke} />
      ) : null}
      {id === "cloud" ? (
        <path d="M7.5 16.5 H17.2 A3.2 3.2 0 0 0 17.5 10.2 A4 4 0 0 0 10.2 9.4 A3.2 3.2 0 0 0 7.5 16.5 Z" {...stroke} />
      ) : null}
      {id === "banner" ? <path d="M4.5 5.5 H19.5 V16.5 L12 19.5 L4.5 16.5 Z" {...stroke} /> : null}
      {id === "cross" ? <path d="M9 4.5 H15 V9 H19.5 V15 H15 V19.5 H9 V15 H4.5 V9 H9 Z" {...stroke} /> : null}
      {id === "parallelogram" ? <path d="M7.5 5.5 H20.5 L16.5 18.5 H3.5 Z" {...stroke} /> : null}
    </svg>
  );
}
