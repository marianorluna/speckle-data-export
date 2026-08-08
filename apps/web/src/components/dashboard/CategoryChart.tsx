import { useEffect, useState } from "react";
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
import type { OverviewCrossFilter } from "../../hooks/useOverviewCrossFilter";
import { Card } from "../ui/Card";
import { ErrorMessage } from "../ui/ErrorMessage";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { chartColorAt } from "./chartPalette";
import {
  OTHERS_FILL,
  TOP_N,
  topNWithOthers,
  type TopNBarRow,
} from "./topNWithOthers";

type CategoryChartProps = {
  filters?: OverviewCrossFilter;
  activeCategory?: string;
  onSelectCategory?: (category: string | null) => void;
};

function ColoredBar(
  props: BarShapeProps & { activeCategory?: string },
) {
  const payload = props.payload as TopNBarRow | undefined;
  const index =
    typeof props.index === "number" ? props.index : Number(props.index) || 0;
  const baseFill = payload?.isOthers ? OTHERS_FILL : chartColorAt(index);
  const isActive =
    props.activeCategory !== undefined &&
    payload !== undefined &&
    !payload.isOthers &&
    payload.name === props.activeCategory;
  const hasSelection = props.activeCategory !== undefined;
  const opacity = !hasSelection || isActive || payload?.isOthers ? 1 : 0.35;
  return <Rectangle {...props} fill={baseFill} fillOpacity={opacity} />;
}

const LABEL_FONT_SIZE = 11;
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
  payload?: ReadonlyArray<{ payload?: TopNBarRow }>;
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
      <p className="font-medium text-gray-900">{row.name}</p>
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

export function CategoryChart({
  filters = {},
  activeCategory,
  onSelectCategory,
}: CategoryChartProps) {
  const { data, isLoading, isError, error, refetch } = useCategories(filters);
  const [entranceDone, setEntranceDone] = useState(false);
  const chartReady = !isLoading && !isError;

  useEffect(() => {
    if (!chartReady || entranceDone) {
      return;
    }
    const timer = window.setTimeout(() => setEntranceDone(true), 2500);
    return () => window.clearTimeout(timer);
  }, [chartReady, entranceDone]);

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

  const named = (data ?? []).map((row) => ({
    name: row.category,
    count: row.count,
  }));
  const { chartRows, totalNames } = topNWithOthers(named);
  const shownNamed = Math.min(TOP_N, totalNames);
  const subtitle =
    totalNames > TOP_N
      ? `Top ${shownNamed} de ${totalNames} + Otros`
      : `${totalNames} categorías`;
  const yAxisWidth = estimateYAxisWidth(chartRows.map((row) => row.name));

  const handleBarClick = (row: TopNBarRow) => {
    if (!onSelectCategory || row.isOthers) {
      return;
    }
    onSelectCategory(row.name);
  };

  return (
    <Card
      title="Elementos por categoría"
      subtitle={subtitle}
      className="flex h-full min-h-0 flex-col p-3"
    >
      {chartRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Sin datos de categorías
        </p>
      ) : (
        <div className="h-[200px] w-full min-w-0 min-h-0 flex-1 lg:h-auto">
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
                dataKey="name"
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
                shape={(props: BarShapeProps) => (
                  <ColoredBar {...props} activeCategory={activeCategory} />
                )}
                radius={[0, 4, 4, 0]}
                isAnimationActive={entranceDone ? false : "auto"}
                onAnimationEnd={() => setEntranceDone(true)}
                cursor={onSelectCategory ? "pointer" : undefined}
                onClick={(item) => {
                  const row = item?.payload as TopNBarRow | undefined;
                  if (row) {
                    handleBarClick(row);
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
