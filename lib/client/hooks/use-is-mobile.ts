"use client";

import { useEffect, useState } from "react";

import { MOBILE_MEDIA_QUERY } from "@/lib/shared/utils/media-queries";

export function useIsMobile(query: string = MOBILE_MEDIA_QUERY) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setIsMobile(mql.matches);

    update();
    mql.addEventListener("change", update);

    return () => mql.removeEventListener("change", update);
  }, [query]);

  return isMobile;
}
