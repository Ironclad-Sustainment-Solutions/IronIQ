import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { SEVERITY_LABELS, type FindingSeverity } from "@/lib/domain";

const axisStyle = { fill: "var(--muted-foreground)", fontSize: 11 };

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: 12,
};

export function CategoryRadar({ data }: { data: { category: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="category" tick={axisStyle} />
        <PolarRadiusAxis domain={[0, 100]} tick={axisStyle} stroke="var(--border)" />
        <Radar
          name="Readiness"
          dataKey="score"
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.28}
        />
        <Tooltip contentStyle={tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({
  data,
}: {
  data: { period: string; readiness: number; confidence: number | null }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="period" tick={axisStyle} stroke="var(--border)" />
        <YAxis domain={[0, 100]} tick={axisStyle} stroke="var(--border)" />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
        <Line
          type="monotone"
          dataKey="readiness"
          name="Readiness Score"
          stroke="var(--primary)"
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="confidence"
          name="Confidence Score"
          stroke="var(--chart-2)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const severityColor: Record<FindingSeverity, string> = {
  critical: "var(--critical)",
  high: "var(--sev-high)",
  medium: "var(--sev-medium)",
  low: "var(--sev-low)",
  opportunity: "var(--sev-opportunity)",
};

export function SeverityDonut({ counts }: { counts: Record<FindingSeverity, number> }) {
  const data = (Object.keys(severityColor) as FindingSeverity[])
    .map((s) => ({ name: SEVERITY_LABELS[s], value: counts[s] ?? 0, key: s }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">No findings recorded.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={severityColor[entry.key]} stroke="var(--surface)" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
