import { useTranslations } from "next-intl";

import type { GeoError } from "@/lib/locationUtils";

/** Plain-language explanation for a geolocation problem (English or Bengali, from the message files). */
export function useLocationErrorMessage() {
  const t = useTranslations("location.errors");
  return (error: GeoError | null): string | null => {
    if (!error) return null;
    const key = error.code === "position_unavailable" && error.offline ? "position_offline" : error.code;
    return t(key);
  };
}
