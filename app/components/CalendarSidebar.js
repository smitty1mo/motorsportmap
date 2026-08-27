"use client";

import { useEffect, useMemo, useRef } from "react";
import circuits from "../../data/circuits.json";
import calendar from "../../data/calendar.json";

const seriesLabels = {
  f1: "F1",
  motogp: "MotoGP",
  wec: "WEC",
  indycar: "IndyCar",
};

const circuitById = new Map(circuits.map((circuit) => [circuit.id, circuit]));

export const calendarEvents = calendar
  .map((round) => ({
    ...round,
    circuit: circuitById.get(round.circuitId),
  }))
  .filter((event) => event.circuit)
  .sort((first, second) => first.startDate.localeCompare(second.startDate));

export function getNearestEvent(circuitId, viewingDate, seriesId) {
  const events = calendarEvents.filter(
    (event) =>
      event.circuitId === circuitId && (!seriesId || event.series === seriesId),
  );
  if (events.length === 0) return null;

  const viewingTime = Date.parse(viewingDate);
  const activeEvent = events.find(
    (event) =>
      Date.parse(event.startDate) <= viewingTime &&
      Date.parse(event.endDate) >= viewingTime,
  );
  if (activeEvent) return activeEvent;

  const upcomingEvent = events.find((event) => Date.parse(event.startDate) > viewingTime);
  return upcomingEvent || events[events.length - 1];
}

function formatDateRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const options = { month: "short", day: "numeric", timeZone: "UTC" };
  return `${start.toLocaleDateString("en-US", options)} - ${end.toLocaleDateString("en-US", options)}`;
}

export default function CalendarSidebar({
  viewingDate,
  activeEventIds,
  selectedEventId,
  onEventSelect,
  message,
  seriesId,
}) {
  const listRef = useRef(null);
  const eventRefs = useRef(new Map());
  const scrollTimeout = useRef(null);
  const events = useMemo(
    () =>
      seriesId
        ? calendarEvents.filter((event) => event.series === seriesId)
        : calendarEvents,
    [seriesId],
  );
  const activeIds = new Set(activeEventIds);

  useEffect(() => {
    const currentActiveIds = new Set(activeEventIds);
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const targetEvent = events.find((event) => currentActiveIds.has(eventKey(event))) ||
        events.find((event) => Date.parse(event.startDate) >= Date.parse(viewingDate)) ||
        events[events.length - 1];
      const target = targetEvent && eventRefs.current.get(eventKey(targetEvent));
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 350);

    return () => clearTimeout(scrollTimeout.current);
  }, [viewingDate, activeEventIds, events]);

  return (
    <aside className="calendar-sidebar">
      <header className="calendar-sidebar-header">
        <p className="panel-kicker">Season schedule</p>
        <h1>Race calendar</h1>
        <p>
          {events.length} events{seriesId ? " in this series" : " across four series"}
        </p>
      </header>
      {message && <p className="calendar-message">{message}</p>}
      <div className="calendar-list" ref={listRef}>
        {events.map((event) => {
          const key = eventKey(event);
          const isActive = activeIds.has(key);
          const isSelected = selectedEventId === key;
          return (
            <button
              className={`calendar-event${isActive ? " is-active" : ""}${isSelected ? " is-selected" : ""}`}
              key={key}
              ref={(element) => {
                if (element) eventRefs.current.set(key, element);
                else eventRefs.current.delete(key);
              }}
              type="button"
              onClick={() => onEventSelect(event)}
            >
              <span className="calendar-event-series" data-series={event.series}>
                {seriesLabels[event.series] || event.series}
              </span>
              <span className="calendar-event-details">
                <strong>{event.circuit.name}</strong>
                <span>{event.circuit.country}</span>
              </span>
              <time>{formatDateRange(event.startDate, event.endDate)}</time>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function eventKey(event) {
  return `${event.series}-${event.round}-${event.circuitId}`;
}

export { eventKey, seriesLabels };
