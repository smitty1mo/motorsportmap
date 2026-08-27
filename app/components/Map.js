"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import circuits from "../../data/circuits.json";
import calendar from "../../data/calendar.json";

const seasonStart = calendar.reduce(
  (earliest, round) =>
    round.startDate < earliest ? round.startDate : earliest,
  calendar[0].startDate,
);
const seasonEnd = calendar.reduce(
  (latest, round) => (round.endDate > latest ? round.endDate : latest),
  calendar[0].endDate,
);
const dayMilliseconds = 24 * 60 * 60 * 1000;
const seasonStartTime = Date.parse(seasonStart);

function dateToSliderValue(date) {
  return Math.round((Date.parse(date) - seasonStartTime) / dayMilliseconds);
}

function sliderValueToDate(value) {
  return new Date(seasonStartTime + value * dayMilliseconds)
    .toISOString()
    .slice(0, 10);
}

const seriesColors = {
  f1: "#e10600",
  motogp: "#00a8e8",
  wec: "#f5a623",
  indycar: "#41a63c",
};

export function getActiveRounds(date) {
  return calendar.filter(
    (round) => round.startDate <= date && round.endDate >= date,
  );
}

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
  const markersRef = useRef([]);
  const [viewingDate, setViewingDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

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
    markersRef.current = markers.map((marker, index) => ({
      marker,
      circuitId: circuits[index].id,
    }));

    return () => {
      markers.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
    };
  }, []);

  useEffect(() => {
    const activeCircuitIds = new Set(
      getActiveRounds(viewingDate).map((round) => round.circuitId),
    );

    markersRef.current.forEach(({ marker, circuitId }) => {
      const isActive = activeCircuitIds.has(circuitId);
      marker.getElement().style.opacity = isActive ? "1" : "0";
      marker.getElement().style.pointerEvents = isActive ? "auto" : "none";
    });
  }, [viewingDate]);

  return (
    <main className="relative h-screen w-full">
      <div ref={mapContainer} className="h-full w-full" />
      <label className="date-control">
        <span>Viewing date: {viewingDate}</span>
        <input
          type="range"
          min="0"
          max={dateToSliderValue(seasonEnd)}
          value={dateToSliderValue(viewingDate)}
          onChange={(event) =>
            setViewingDate(sliderValueToDate(Number(event.target.value)))
          }
        />
      </label>
    </main>
  );
}
