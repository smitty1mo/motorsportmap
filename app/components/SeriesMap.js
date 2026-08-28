"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const seriesColors = {
  f1: "#e10600",
  motogp: "#00a8e8",
  wec: "#f5a623",
  indycar: "#41a63c",
};

export default function SeriesMap({
  circuits,
  rounds,
  seriesId,
  selectedCircuitId,
  onCircuitSelect,
}) {
  const mapContainer = useRef(null);
  const markersRef = useRef([]);
  const circuitSelectRef = useRef(onCircuitSelect);

  useEffect(() => {
    circuitSelectRef.current = onCircuitSelect;
  }, [onCircuitSelect]);

  useEffect(() => {
    if (!mapContainer.current) {
      return undefined;
    }

    const color = seriesColors[seriesId] || "#e10600";
    const map = new MapLibreMap({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [0, 20],
      zoom: 1.2,
    });
    const markers = [];
    const routeCoordinates = [];

    rounds.forEach((round) => {
      const circuit = circuits.find((item) => item.id === round.circuitId);
      if (!circuit) {
        return;
      }

      routeCoordinates.push([circuit.lon, circuit.lat]);
      const markerElement = document.createElement("div");
      markerElement.className = "series-marker";
      markerElement.style.backgroundColor = color;
      markerElement.title = circuit.name;
      markerElement.setAttribute("role", "button");
      markerElement.setAttribute("tabindex", "0");
      markerElement.addEventListener("click", () =>
        circuitSelectRef.current(circuit),
      );
      markers.push(
        new Marker({ element: markerElement })
          .setLngLat([circuit.lon, circuit.lat])
          .addTo(map),
      );
    });

    map.addControl(new NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource("season-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: routeCoordinates,
          },
        },
      });
      map.addLayer({
        id: "season-route-line",
        type: "line",
        source: "season-route",
        paint: {
          "line-color": color,
          "line-width": 3,
          "line-opacity": 0.8,
        },
      });
    });

    markersRef.current = markers.map((marker, index) => ({
      marker,
      circuitId: rounds[index]?.circuitId,
    }));

    return () => {
      markers.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
    };
  }, [circuits, rounds, seriesId]);

  useEffect(() => {
    markersRef.current.forEach(({ marker, circuitId }) => {
      marker.getElement().style.opacity =
        !selectedCircuitId || circuitId === selectedCircuitId ? "1" : "0.2";
    });
  }, [selectedCircuitId]);

  return <div ref={mapContainer} className="h-full w-full" />;
}
