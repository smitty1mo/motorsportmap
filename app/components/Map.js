"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import circuits from "../../data/circuits.json";
import calendar from "../../data/calendar.json";
import CalendarSidebar, {
  eventKey,
  getNearestEvent,
} from "./CalendarSidebar";

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
const seasonEndTime = Date.parse(seasonEnd);
const weekMilliseconds = 7 * dayMilliseconds;

function getMonday(date) {
  const monday = new Date(`${date}T00:00:00Z`);
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
  return monday;
}

const seasonStartWeek = getMonday(seasonStart);
const seasonEndWeek = getMonday(seasonEnd);
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
  return Math.round(
    (getMonday(date).getTime() - seasonStartWeek.getTime()) / weekMilliseconds,
  );
}

function sliderValueToDate(value) {
  return new Date(seasonStartWeek.getTime() + value * weekMilliseconds)
    .toISOString()
    .slice(0, 10);
}

function getInitialViewingDate() {
  const today = Date.now();
  const clampedTime = Math.min(Math.max(today, seasonStartTime), seasonEndTime);
  return getMonday(new Date(clampedTime).toISOString().slice(0, 10))
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
  const weekStart = getMonday(date).toISOString().slice(0, 10);
  const weekEnd = new Date(getMonday(date).getTime() + 6 * dayMilliseconds)
    .toISOString()
    .slice(0, 10);

  return calendar.filter(
    (round) => round.startDate <= weekEnd && round.endDate >= weekStart,
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

  if (circuit.series.length > 1) {
    markerElement.classList.add("multi-series-marker");
    const seriesCount = document.createElement("span");
    seriesCount.className = "series-count";
    seriesCount.textContent = circuit.series.length;
    seriesCount.title = `${circuit.series.length} series`;
    markerElement.append(seriesCount);
  }

  return markerElement;
}

export default function Map() {
  const mapContainer = useRef(null);
  const markersRef = useRef([]);
  const viewingDateRef = useRef(null);
  const [mapStatus, setMapStatus] = useState("loading");
  const [viewingDate, setViewingDate] = useState(getInitialViewingDate);
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [weatherByCircuit, setWeatherByCircuit] = useState({});
  const [weatherStatus, setWeatherStatus] = useState("idle");
  const [selectedCircuit, setSelectedCircuit] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [sidebarMessage, setSidebarMessage] = useState("");

  useEffect(() => {
    viewingDateRef.current = viewingDate;
  }, [viewingDate]);

  const activeRounds = getActiveRounds(viewingDate);
  const activeEventIds = activeRounds.map(eventKey);

  function handleCircuitClick(circuit) {
    const nearestEvent = getNearestEvent(circuit.id, viewingDateRef.current);
    setSelectedCircuit(circuit);
    setSidebarMessage(
      nearestEvent ? "" : `${circuit.name} is not on the current calendar.`,
    );
    if (nearestEvent) {
      setViewingDate(getMonday(nearestEvent.startDate).toISOString().slice(0, 10));
      setSelectedEventId(eventKey(nearestEvent));
    }
  }

  function handleEventSelect(event) {
    setSidebarMessage("");
    setSelectedCircuit(event.circuit);
    setSelectedEventId(eventKey(event));
    setViewingDate(getMonday(event.startDate).toISOString().slice(0, 10));
  }

  useEffect(() => {
    if (!mapContainer.current) {
      return undefined;
    }

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [0, 20],
      zoom: 1.2,
    });

    let usedFallbackStyle = false;
    map.on("load", () => {
      setMapStatus("ready");
      if (map.getSource("circuit-clusters")) return;
      map.addSource("circuit-clusters", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: circuits.map((circuit) => ({
            type: "Feature",
            properties: { name: circuit.name },
            geometry: {
              type: "Point",
              coordinates: [circuit.lon, circuit.lat],
            },
          })),
        },
        cluster: true,
        clusterMaxZoom: 5,
        clusterRadius: 48,
      });
      map.addLayer({
        id: "circuit-cluster-circles",
        type: "circle",
        source: "circuit-clusters",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#182126",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            10,
            23,
            30,
            29,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "circuit-cluster-count",
        type: "symbol",
        source: "circuit-clusters",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.on("click", "circuit-cluster-circles", (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["circuit-cluster-circles"],
        });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId === undefined) return;
        map
          .getSource("circuit-clusters")
          .getClusterExpansionZoom(clusterId, (error, zoom) => {
            if (!error) {
              map.easeTo({ center: features[0].geometry.coordinates, zoom });
            }
          });
      });
    });
    map.on("error", (event) => {
      if (!usedFallbackStyle && event.error) {
        usedFallbackStyle = true;
        setMapStatus("fallback");
        map.setStyle("https://demotiles.maplibre.org/style.json");
      }
    });

    map.addControl(new NavigationControl(), "top-right");

    const updateMarkerScale = () => {
      const scale = map.getZoom() < 3 ? "small" : map.getZoom() < 6 ? "medium" : "large";
      markersRef.current.forEach(({ marker }) => {
        marker.getElement().dataset.zoom = scale;
        marker.getElement().style.visibility =
          marker.getElement().dataset.active === "true" || map.getZoom() >= 4
            ? "visible"
            : "hidden";
      });
    };

    const markers = circuits.map((circuit) => {
      const markerElement = createCircuitMarker(circuit);
      const marker = new Marker({ element: markerElement })
        .setLngLat([circuit.lon, circuit.lat])
        .addTo(map);

      markerElement.addEventListener("click", (event) => {
        event.stopPropagation();
        handleCircuitClick(circuit);
      });

      return marker;
    });
    markersRef.current = markers.map((marker, index) => ({
      marker,
      circuitId: circuits[index].id,
    }));
    map.on("zoom", updateMarkerScale);
    updateMarkerScale();

    return () => {
      markers.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.off("zoom", updateMarkerScale);
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
      marker.getElement().style.opacity = isActive ? "1" : "0.28";
      marker.getElement().dataset.active = isActive ? "true" : "false";
      marker.getElement().style.pointerEvents = "auto";
      weatherBadge.hidden = !isActive || !weatherEnabled || !weather;
      if (weather) {
        weatherBadge.textContent = weather.icon;
        weatherBadge.title = weather.label;
      }
      marker.getElement().style.visibility =
        isActive || window.matchMedia("(min-width: 641px)").matches
          ? "visible"
          : "hidden";
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
    if (activeCircuits.length === 0) {
      return () => controller.abort();
    }

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
              end_date: new Date(
                getMonday(viewingDate).getTime() + 6 * dayMilliseconds,
              )
                .toISOString()
                .slice(0, 10),
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
    <main className="map-shell">
      <CalendarSidebar
        viewingDate={viewingDate}
        activeEventIds={activeEventIds}
        selectedEventId={selectedEventId}
        onEventSelect={handleEventSelect}
        message={sidebarMessage}
      />
      <section className="map-stage">
      <div ref={mapContainer} className="map-canvas" />
      {mapStatus === "loading" && <p className="map-status">Loading map...</p>}
      {mapStatus === "fallback" && (
        <p className="map-status">Using backup map style</p>
      )}
      <nav className="series-control" aria-label="Series">
        <Link href="/series/f1">F1</Link>
        <Link href="/series/motogp">MotoGP</Link>
        <Link href="/series/wec">WEC</Link>
        <Link href="/series/indycar">IndyCar</Link>
      </nav>
      <section className="map-legend" aria-label="Series legend">
        <strong>Series</strong>
        {Object.entries(seriesColors).map(([series, color]) => (
          <span key={series}>
            <i style={{ backgroundColor: color }} />
            {series === "f1" ? "F1" : series === "motogp" ? "MotoGP" : series === "indycar" ? "IndyCar" : "WEC"}
          </span>
        ))}
      </section>
      {getActiveRounds(viewingDate).length === 0 && (
        <p className="empty-state">No races this week. Drag the timeline to explore the season.</p>
      )}
      {selectedCircuit && (
        <aside className="circuit-panel" aria-label="Circuit details">
          <button
            className="panel-close"
            type="button"
            onClick={() => setSelectedCircuit(null)}
            aria-label="Close circuit details"
          >
            x
          </button>
          <p className="panel-kicker">Circuit</p>
          <h2>{selectedCircuit.name}</h2>
          <p>{selectedCircuit.country}</p>
          <div className="panel-series">
            {selectedCircuit.series.map((series) => (
              <span key={series} style={{ borderColor: seriesColors[series] }}>
                {series === "f1" ? "F1" : series === "motogp" ? "MotoGP" : series === "indycar" ? "IndyCar" : "WEC"}
              </span>
            ))}
          </div>
          {weatherByCircuit[selectedCircuit.id] && weatherEnabled && (
            <p className="panel-weather">
              {weatherByCircuit[selectedCircuit.id].icon} {weatherByCircuit[selectedCircuit.id].label}
            </p>
          )}
        </aside>
      )}
      <label className="date-control">
        <span>
          Viewing week: {viewingDate} to {sliderValueToDate(dateToSliderValue(viewingDate) + 1)}
        </span>
        <input
          type="range"
          min="0"
          max={dateToSliderValue(seasonEndWeek.toISOString().slice(0, 10))}
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
          {weatherEnabled && getActiveRounds(viewingDate).length === 0 &&
            " (no active rounds)"}
        </span>
      </label>
      </section>
    </main>
  );
}
