import { notFound } from "next/navigation";
import calendar from "../../../data/calendar.json";
import circuits from "../../../data/circuits.json";
import SeriesPageClient from "./SeriesPageClient";

const series = ["f1", "motogp", "wec", "indycar"];

export function generateStaticParams() {
  return series.map((seriesId) => ({ seriesId }));
}

export default async function SeriesPage({ params }) {
  const { seriesId } = await params;
  if (!series.includes(seriesId)) {
    notFound();
  }

  const rounds = calendar
    .filter((round) => round.series === seriesId)
    .sort((first, second) => first.round - second.round);
  const label = seriesId === "f1" ? "F1" : seriesId.toUpperCase();

  return (
    <SeriesPageClient
      circuits={circuits}
      label={label}
      rounds={rounds}
      seriesId={seriesId}
    />
  );
}
