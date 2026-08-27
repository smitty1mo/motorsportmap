import { notFound } from "next/navigation";
import Link from "next/link";
import calendar from "../../../data/calendar.json";
import circuits from "../../../data/circuits.json";
import SeriesMap from "../../components/SeriesMap";

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
    <main className="relative h-screen w-full">
      <SeriesMap circuits={circuits} rounds={rounds} seriesId={seriesId} />
      <header className="series-header">
        <Link href="/">Back to world map</Link>
        <h1>{label} season route</h1>
        <p>{rounds.length} rounds connected in calendar order</p>
      </header>
    </main>
  );
}
