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

/**
 * Agibankz reporting chart: planned vs completed story points per week.
 * Lime completed bars on the track colour, hairline #E5E7E5 grid, no
 * slate/blue anywhere.
 */
export function VelocityChart({ data }: { data: VelocityPoint[] }) {
  return (
    <Card>
      <CardHeader title="Sprint velocity" subtitle="Completed vs planned story points" />
      <div className="h-72 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E5" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fill: "#8A8F8A", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#8A8F8A", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "#FFFFFF",
                border: "1px solid #E5E7E5",
                borderRadius: 14,
                fontSize: 13,
                color: "#111211",
              }}
              cursor={{ fill: "#F4F4F2" }}
            />
            <Legend wrapperStyle={{ fontSize: 13, color: "#8A8F8A" }} />
            <Bar dataKey="planned" fill="#E3E6E3" name="Planned" radius={[8, 8, 0, 0]} />
            <Bar dataKey="completed" fill="#A3E635" name="Completed" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
