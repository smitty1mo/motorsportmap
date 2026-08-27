"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function Map() {
  const mapContainer = useRef(null);

  useEffect(() => {
    if (!mapContainer.current) {
      return undefined;
    }

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [0, 20],
      zoom: 1.2,
    });

    map.addControl(new NavigationControl(), "top-right");

    return () => map.remove();
  }, []);

  return <div ref={mapContainer} className="h-screen w-full" />;
}
