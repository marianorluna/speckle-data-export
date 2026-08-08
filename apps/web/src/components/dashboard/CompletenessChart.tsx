import { useEffect, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { useCompleteness } from "../../hooks/useFacets";
import type {
  CompletenessBucket,
  OverviewCrossFilter,
} from "../../hooks/useOverviewCrossFilter";
import { Card } from "../ui/Card";
import { ErrorMessage } from "../ui/ErrorMessage";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { chartColorAt } from "./chartPalette";

type CompletenessRow = {
  key: CompletenessBucket;
  name: string;
  count: number;
  percent: number;
  fill: string;
};

type CompletenessChartProps = {
  filters?: OverviewCrossFilter;
  activeBucket?: CompletenessBucket;
  onSelectBucket?: (bucket: CompletenessBucket | null) => void;
};

const BUCKET_META: {
  key: CompletenessBucket;
  name: string;
  colorIndex: number;
}[] = [
  { key: "missing_level", name: "Sin nivel", colorIndex: 3 },
  { key: "missing_fire", name: "Sin fire_rating", colorIndex: 2 },
  { key: "complete", name: "Completos", colorIndex: 1 },
];

function CompletenessTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CompletenessRow }>;
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
    </div>
  );
}

function CompletenessLegend({
  items,
  activeBucket,
  onSelectBucket,
}: {
  items: CompletenessRow[];
  activeBucket?: CompletenessBucket;
  onSelectBucket?: (bucket: CompletenessBucket | null) => void;
}) {
  const hasSelection = activeBucket !== undefined;
  return (
    <ul className="flex shrink-0 flex-wrap justify-center gap-x-3 gap-y-1 px-1 pt-1 text-xs text-gray-700">
      {items.map((item) => {
        const isActive = activeBucket === item.key;
        const dimmed = hasSelection && !isActive;
        return (
          <li key={item.key}>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-sm ${
                onSelectBucket ? "cursor-pointer hover:underline" : ""
              } ${dimmed ? "opacity-40" : ""}`}
              onClick={() => onSelectBucket?.(item.key)}
              disabled={!onSelectBucket || item.count === 0}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: item.fill }}
                aria-hidden
              />
              <span>
                {item.name} ({item.count})
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function CompletenessChart({
  filters = {},
  activeBucket,
  onSelectBucket,
}: CompletenessChartProps) {
  const { data, isLoading, isError, error, refetch } = useCompleteness(filters);
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
      <Card title="Completitud de datos">
        <LoadingSpinner label="Cargando completitud…" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card title="Completitud de datos">
        <ErrorMessage
          message={
            error instanceof Error
              ? error.message
              : "No se pudo cargar la completitud"
          }
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }

  const total =
    (data?.missing_level ?? 0) +
    (data?.missing_fire ?? 0) +
    (data?.complete ?? 0);

  const chartData: CompletenessRow[] = BUCKET_META.map((meta) => {
    const count = data?.[meta.key] ?? 0;
    return {
      key: meta.key,
      name: meta.name,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
      fill: chartColorAt(meta.colorIndex),
    };
  }).filter((row) => row.count > 0);

  const hasSelection = activeBucket !== undefined;

  return (
    <Card
      title="Completitud de datos"
      subtitle="Buckets excluyentes (QC)"
      className="flex h-full min-h-0 flex-col p-3"
    >
      {chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Sin datos de completitud
        </p>
      ) : (
        <div className="flex h-[200px] w-full min-w-0 min-h-0 flex-1 flex-col lg:h-auto">
          <div className="min-h-0 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="45%"
                  outerRadius="80%"
                  isAnimationActive={entranceDone ? false : "auto"}
                  onAnimationEnd={() => setEntranceDone(true)}
                  cursor={onSelectBucket ? "pointer" : undefined}
                  onClick={(_, index) => {
                    const row = chartData[index];
                    if (row && onSelectBucket) {
                      onSelectBucket(row.key);
                    }
                  }}
                >
                  {chartData.map((row) => {
                    const isActive = activeBucket === row.key;
                    const opacity = !hasSelection || isActive ? 1 : 0.35;
                    return (
                      <Cell
                        key={row.key}
                        fill={row.fill}
                        fillOpacity={opacity}
                      />
                    );
                  })}
                </Pie>
                <Tooltip content={<CompletenessTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <CompletenessLegend
            items={chartData}
            activeBucket={activeBucket}
            onSelectBucket={onSelectBucket}
          />
        </div>
      )}
    </Card>
  );
}
