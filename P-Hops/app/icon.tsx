import { ImageResponse } from "next/og";

import { ICON_PATHS } from "@/components/ui/Icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Browser-tab icon: the temple glyph used in the header, white on the brand red. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#a81d1d", borderRadius: 14 }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICON_PATHS.temple} />
        </svg>
      </div>
    ),
    size,
  );
}
