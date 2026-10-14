/** Slippy-map tile maths, used to preload the tiles of the default map view. */

type TileConfig = { tileUrl: string; center: [number, number]; zoom: number };

/** The 2x2 block of tiles closest to the map centre at the initial zoom (what a phone shows first). */
export function initialTileUrls({ tileUrl, center: [lat, lng], zoom }: TileConfig): string[] {
  const n = 2 ** zoom;
  const fx = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x0 = Math.floor(fx) - (fx % 1 < 0.5 ? 1 : 0);
  const y0 = Math.floor(fy) - (fy % 1 < 0.5 ? 1 : 0);
  const urls: string[] = [];
  for (const x of [x0, x0 + 1]) {
    for (const y of [y0, y0 + 1]) {
      urls.push(tileUrl.replace("{z}", String(zoom)).replace("{x}", String(x)).replace("{y}", String(y)));
    }
  }
  return urls;
}
