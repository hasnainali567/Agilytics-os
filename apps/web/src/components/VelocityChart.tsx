import type { VelocityPoint } from "@agilytics/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader } from "./ui";

/** DealDeck-style reporting chart: planned vs completed story points per week. */
export function VelocityChart({ data }: { data: VelocityPoint[] }) {
  return (
    <Card>
      <CardHeader title="Sprint velocity" subtitle="Completed vs planned story points" />
      <div className="h-72 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="planned" fill="#94a3b8" name="Planned" radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" fill="#1d4ed8" name="Completed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
