"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import circuits from "../../data/circuits.json";

const seriesColors = {
  f1: "#e10600",
  motogp: "#00a8e8",
  wec: "#f5a623",
  indycar: "#41a63c",
};

function createCircuitMarker(circuit) {
  const markerElement = document.createElement("button");
  const colors = circuit.series.map(
    (series) => seriesColors[series] || "#ffffff",
  );

  markerElement.type = "button";
  markerElement.className = "circuit-marker";
  markerElement.title = circuit.name;
  markerElement.setAttribute("aria-label", `Show ${circuit.name}`);
  markerElement.style.background = `conic-gradient(${colors
    .map(
      (color, index) =>
        `${color} ${index * (100 / colors.length)}% ${(index + 1) * (100 / colors.length)}%`,
    )
    .join(", ")})`;

  return markerElement;
}

function createCircuitPopup(circuit) {
  const popupContent = document.createElement("div");
  const name = document.createElement("strong");
  const country = document.createElement("span");

  name.textContent = circuit.name;
  country.textContent = circuit.country;
  popupContent.append(name, country);

  return popupContent;
}

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

    const markers = circuits.map((circuit) => {
      const marker = new Marker({
        element: createCircuitMarker(circuit),
      })
        .setLngLat([circuit.lon, circuit.lat])
        .setPopup(
          new Popup({ offset: 12 }).setDOMContent(
            createCircuitPopup(circuit),
          ),
        )
        .addTo(map);

      return marker;
    });

    return () => {
      markers.forEach((marker) => marker.remove());
      map.remove();
    };
  }, []);

  return <div ref={mapContainer} className="h-screen w-full" />;
}
