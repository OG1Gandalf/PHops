import { ImageResponse } from "next/og";

import { ICON_PATHS } from "@/components/ui/Icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS ("Add to Home Screen"). iOS rounds the corners itself, so the square is full-bleed. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#a81d1d" }}>
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#f6d77a" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICON_PATHS.temple} />
        </svg>
      </div>
    ),
    size,
  );
}
