"use client";

import { useState } from "react";
import Link from "next/link";
import CalendarSidebar, { eventKey } from "../../components/CalendarSidebar";
import SeriesMap from "../../components/SeriesMap";

const dayMilliseconds = 24 * 60 * 60 * 1000;

function getMonday(date) {
  const monday = new Date(`${date}T00:00:00Z`);
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
  return monday;
}

function getInitialViewingDate(rounds) {
  const firstDate = getMonday(rounds[0].startDate);
  const lastDate = getMonday(rounds[rounds.length - 1].endDate);
  const today = getMonday(new Date().toISOString().slice(0, 10));
  const boundedTime = Math.min(
    Math.max(today.getTime(), firstDate.getTime()),
    lastDate.getTime(),
  );
  return new Date(boundedTime).toISOString().slice(0, 10);
}

function getActiveRounds(rounds, date) {
  const weekStart = getMonday(date);
  const weekEnd = new Date(weekStart.getTime() + 6 * dayMilliseconds)
    .toISOString()
    .slice(0, 10);
  const startDate = weekStart.toISOString().slice(0, 10);
  return rounds.filter(
    (round) => round.startDate <= weekEnd && round.endDate >= startDate,
  );
}

function dateToWeekValue(date, seasonStart) {
  return Math.round(
    (getMonday(date).getTime() - getMonday(seasonStart).getTime()) /
      (7 * dayMilliseconds),
  );
}

function weekValueToDate(value, seasonStart) {
  return new Date(
    getMonday(seasonStart).getTime() + value * 7 * dayMilliseconds,
  )
    .toISOString()
    .slice(0, 10);
}

export default function SeriesPageClient({ seriesId, label, circuits, rounds }) {
  const [viewingDate, setViewingDate] = useState(() =>
    getInitialViewingDate(rounds),
  );
  const [selectedEventId, setSelectedEventId] = useState(null);
  const activeEventIds = getActiveRounds(rounds, viewingDate).map(eventKey);
  const seasonStart = rounds[0].startDate;
  const seasonEnd = rounds[rounds.length - 1].endDate;

  function handleEventSelect(event) {
    setSelectedEventId(eventKey(event));
    setViewingDate(getMonday(event.startDate).toISOString().slice(0, 10));
  }

  return (
    <main className="map-shell">
      <CalendarSidebar
        seriesId={seriesId}
        key={seriesId}
        viewingDate={viewingDate}
        activeEventIds={activeEventIds}
        selectedEventId={selectedEventId}
        onEventSelect={handleEventSelect}
      />
      <section className="map-stage">
        <SeriesMap circuits={circuits} rounds={rounds} seriesId={seriesId} />
        <header className="series-header">
          <Link href="/">Back to world map</Link>
          <h1>{label} season route</h1>
          <p>{rounds.length} rounds connected in calendar order</p>
        </header>
        <label className="date-control series-date-control">
          <span>Viewing week: {viewingDate}</span>
          <input
            type="range"
            min="0"
            max={dateToWeekValue(seasonEnd, seasonStart)}
            value={dateToWeekValue(viewingDate, seasonStart)}
            onChange={(event) =>
              setViewingDate(
                weekValueToDate(Number(event.target.value), seasonStart),
              )
            }
          />
        </label>
      </section>
    </main>
  );
}
