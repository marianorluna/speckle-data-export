import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BarShapeProps } from "recharts";

import { useCategories } from "../../hooks/useFacets";
import type { CategoryCount } from "../../hooks/useFacets";
import { Card } from "../ui/Card";
import { ErrorMessage } from "../ui/ErrorMessage";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { chartColorAt } from "./chartPalette";

const TOP_N = 10;
const OTHERS_LABEL = "Otros";
const OTHERS_FILL = "#94a3b8"; // slate-400

type CategoryBarRow = {
  category: string;
  count: number;
  percent: number;
  isOthers: boolean;
  othersCount?: number;
};

/** Keep top N by count; fold the long tail into a single "Otros" bucket. */
export function topNWithOthers(
  rows: CategoryCount[],
  topN: number = TOP_N,
): { chartRows: CategoryBarRow[]; totalCategories: number; totalElements: number } {
  const totalElements = rows.reduce((sum, row) => sum + row.count, 0);
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const head = sorted.slice(0, topN);
  const tail = sorted.slice(topN);
  const othersTotal = tail.reduce((sum, row) => sum + row.count, 0);

  const toRow = (
    category: string,
    count: number,
    extra?: Partial<CategoryBarRow>,
  ): CategoryBarRow => ({
    category,
    count,
    percent: totalElements > 0 ? (count / totalElements) * 100 : 0,
    isOthers: false,
    ...extra,
  });

  const chartRows: CategoryBarRow[] = head.map((row) =>
    toRow(row.category, row.count),
  );

  if (tail.length > 0) {
    chartRows.push(
      toRow(OTHERS_LABEL, othersTotal, {
        isOthers: true,
        othersCount: tail.length,
      }),
    );
  }

  // First row renders at the top of a vertical BarChart → keep descending order.
  return {
    chartRows,
    totalCategories: rows.length,
    totalElements,
  };
}

function ColoredBar(props: BarShapeProps) {
  const payload = props.payload as CategoryBarRow | undefined;
  const index =
    typeof props.index === "number"
      ? props.index
      : Number(props.index) || 0;
  const fill = payload?.isOthers ? OTHERS_FILL : chartColorAt(index);
  return <Rectangle {...props} fill={fill} />;
}

const LABEL_FONT_SIZE = 11;
/** Approx glyph width for 11px UI sans — keeps Y-axis band tight to labels. */
const LABEL_CHAR_PX = 6.7;
const LABEL_AXIS_PAD = 12;

function estimateYAxisWidth(labels: string[]): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  return Math.ceil(longest * LABEL_CHAR_PX + LABEL_AXIS_PAD);
}

function CategoryYTick({
  x,
  y,
  payload,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
}) {
  const label = payload?.value ?? "";

  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="#4b5563"
      fontSize={LABEL_FONT_SIZE}
    >
      <title>{label}</title>
      {label}
    </text>
  );
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CategoryBarRow }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-gray-900">{row.category}</p>
      <p className="text-gray-600">
        {row.count} ({row.percent.toFixed(1)}%)
      </p>
      {row.isOthers && row.othersCount ? (
        <p className="mt-1 text-xs text-gray-400">
          {row.othersCount} categorías agrupadas
        </p>
      ) : null}
    </div>
  );
}

export function CategoryChart() {
  const { data, isLoading, isError, error, refetch } = useCategories();

  if (isLoading) {
    return (
      <Card title="Elementos por categoría">
        <LoadingSpinner label="Cargando categorías…" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card title="Elementos por categoría">
        <ErrorMessage
          message={
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las categorías"
          }
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }

  const { chartRows, totalCategories } = topNWithOthers(data ?? []);
  const shownNamed = Math.min(TOP_N, totalCategories);
  const subtitle =
    totalCategories > TOP_N
      ? `Top ${shownNamed} de ${totalCategories} + Otros`
      : `${totalCategories} categorías`;
  const yAxisWidth = estimateYAxisWidth(chartRows.map((row) => row.category));

  return (
    <Card
      title="Elementos por categoría"
      subtitle={subtitle}
      className="flex h-full min-h-0 flex-col p-4"
    >
      {chartRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Sin datos de categorías
        </p>
      ) : (
        <div className="h-[280px] w-full min-w-0 min-h-0 flex-1 lg:h-auto">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartRows}
              margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                horizontal={false}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={yAxisWidth}
                tick={<CategoryYTick />}
                interval={0}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CategoryTooltip />} />
              <Bar
                dataKey="count"
                name="Elementos"
                shape={ColoredBar}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
