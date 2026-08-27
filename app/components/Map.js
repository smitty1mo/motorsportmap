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
const weatherCodePresentation = {
  0: ["Clear", "☀"],
  1: ["Mostly clear", "🌤"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁"],
  45: ["Fog", "🌫"],
  48: ["Rime fog", "🌫"],
  51: ["Light drizzle", "🌦"],
  53: ["Drizzle", "🌦"],
  55: ["Heavy drizzle", "🌧"],
  61: ["Light rain", "🌦"],
  63: ["Rain", "🌧"],
  65: ["Heavy rain", "🌧"],
  71: ["Light snow", "🌨"],
  73: ["Snow", "🌨"],
  75: ["Heavy snow", "❄"],
  80: ["Rain showers", "🌦"],
  81: ["Showers", "🌧"],
  82: ["Heavy showers", "🌧"],
  95: ["Thunderstorm", "⛈"],
  96: ["Storm and hail", "⛈"],
  99: ["Storm and hail", "⛈"],
};

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

  const weatherBadge = document.createElement("span");
  weatherBadge.className = "weather-badge";
  weatherBadge.hidden = true;
  markerElement.append(weatherBadge);

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
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [weatherByCircuit, setWeatherByCircuit] = useState({});
  const [weatherStatus, setWeatherStatus] = useState("idle");

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
      const weatherBadge = marker.getElement().querySelector(".weather-badge");
      const weather = weatherByCircuit[circuitId];
      marker.getElement().style.opacity = isActive ? "1" : "0";
      marker.getElement().style.pointerEvents = isActive ? "auto" : "none";
      weatherBadge.hidden = !isActive || !weatherEnabled || !weather;
      if (weather) {
        weatherBadge.textContent = weather.icon;
        weatherBadge.title = weather.label;
      }
    });
  }, [viewingDate, weatherByCircuit, weatherEnabled]);

  useEffect(() => {
    if (!weatherEnabled) {
      return undefined;
    }

    const activeCircuits = circuits.filter((circuit) =>
      getActiveRounds(viewingDate).some(
        (round) => round.circuitId === circuit.id,
      ),
    );
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setWeatherStatus("loading");
      try {
        const today = new Date().toISOString().slice(0, 10);
        const isPast = viewingDate < today;
        const weatherResults = await Promise.all(
          activeCircuits.map(async (circuit) => {
            const endpoint = isPast
              ? "https://archive-api.open-meteo.com/v1/archive"
              : "https://api.open-meteo.com/v1/forecast";
            const params = new URLSearchParams({
              latitude: circuit.lat.toString(),
              longitude: circuit.lon.toString(),
              start_date: viewingDate,
              end_date: viewingDate,
              daily: "weather_code,temperature_2m_max",
              timezone: "auto",
            });
            const response = await fetch(`${endpoint}?${params}`, {
              signal: controller.signal,
            });
            if (!response.ok) {
              throw new Error(`Weather request failed: ${response.status}`);
            }
            const result = await response.json();
            const code = result.daily?.weather_code?.[0];
            const [label, icon] = weatherCodePresentation[code] || [
              "Unknown conditions",
              "?",
            ];
            return [circuit.id, { label, icon }];
          }),
        );
        setWeatherByCircuit(Object.fromEntries(weatherResults));
        setWeatherStatus("ready");
      } catch (error) {
        if (error.name !== "AbortError") {
          setWeatherStatus("error");
        }
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [viewingDate, weatherEnabled]);

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
        <span className="weather-control">
          <input
            type="checkbox"
            checked={weatherEnabled}
            onChange={(event) => setWeatherEnabled(event.target.checked)}
          />
          Show weather
          {weatherEnabled && weatherStatus === "loading" && " (loading...)"}
          {weatherEnabled && weatherStatus === "error" && " (unavailable)"}
        </span>
      </label>
    </main>
  );
}
