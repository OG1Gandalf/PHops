import { ImageResponse } from "next/og";

import { OG_IMAGE } from "@/lib/seo";

// One social-preview image for both languages, referenced explicitly from every page's metadata (see lib/seo.ts).
// English-only text on purpose: the default ImageResponse font has no Bengali glyphs.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #8c1515 0%, #a81d1d 55%, #c0392b 100%)",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 34, color: "#f6d77a", fontWeight: 700 }}>
          <div style={{ width: 20, height: 20, borderRadius: 20, background: "#f6d77a" }} />
          Durga Puja 2026
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.05 }}>Kolkata Pujo Guide</div>
          <div style={{ fontSize: 40, lineHeight: 1.3, opacity: 0.92 }}>
            Pandal hopping map with crowd levels, restrooms, parking, eateries and events
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28 }}>
          {["Pandals", "Restrooms", "Parking", "Eateries", "Events"].map((t) => (
            <div key={t} style={{ padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,0.16)", border: "2px solid rgba(255,255,255,0.4)" }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: OG_IMAGE.width, height: OG_IMAGE.height },
  );
}
