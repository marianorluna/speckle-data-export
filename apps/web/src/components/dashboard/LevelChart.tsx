import { useEffect, useState } from "react";
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";
import type { PieSectorShapeProps } from "recharts";

import { useLevels } from "../../hooks/useFacets";
import type { OverviewCrossFilter } from "../../hooks/useOverviewCrossFilter";
import { Card } from "../ui/Card";
import { ErrorMessage } from "../ui/ErrorMessage";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { chartColorAt } from "./chartPalette";

type LevelPieRow = {
  name: string;
  /** Raw level value; ``null`` means «Sin nivel». */
  level: string | null;
  count: number;
  percent: number;
  fill: string;
};

type LevelChartProps = {
  filters?: OverviewCrossFilter;
  activeLevel?: string | null;
  onSelectLevel?: (level: string | null) => void;
  /** When true, ``activeLevel`` is set (including ``null`` for Sin nivel). */
  hasLevelFilter?: boolean;
};

function ColoredPieSector(
  props: PieSectorShapeProps & {
    activeLevel?: string | null;
    hasLevelFilter?: boolean;
  },
) {
  const payload = props.payload as LevelPieRow | undefined;
  const index =
    typeof props.index === "number" ? props.index : Number(props.index) || 0;
  const fill = payload?.fill ?? chartColorAt(index);
  const isActive =
    props.hasLevelFilter === true &&
    payload !== undefined &&
    ((payload.level === null && props.activeLevel === null) ||
      payload.level === props.activeLevel);
  const opacity = !props.hasLevelFilter || isActive ? 1 : 0.35;
  return <Sector {...props} fill={fill} fillOpacity={opacity} />;
}

function LevelTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: LevelPieRow }>;
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

function LevelLegend({
  items,
  activeLevel,
  hasLevelFilter,
  onSelectLevel,
}: {
  items: LevelPieRow[];
  activeLevel?: string | null;
  hasLevelFilter?: boolean;
  onSelectLevel?: (level: string | null) => void;
}) {
  return (
    <ul className="flex shrink-0 flex-wrap justify-center gap-x-3 gap-y-1 px-1 pt-1 text-xs text-gray-700">
      {items.map((item) => {
        const isActive =
          hasLevelFilter === true &&
          ((item.level === null && activeLevel === null) ||
            item.level === activeLevel);
        const dimmed = hasLevelFilter && !isActive;
        return (
          <li key={item.name}>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-sm ${
                onSelectLevel ? "cursor-pointer hover:underline" : ""
              } ${dimmed ? "opacity-40" : ""}`}
              onClick={() => onSelectLevel?.(item.level)}
              disabled={!onSelectLevel}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: item.fill }}
                aria-hidden
              />
              <span>{item.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function LevelChart({
  filters = {},
  activeLevel,
  onSelectLevel,
  hasLevelFilter = false,
}: LevelChartProps) {
  const { data, isLoading, isError, error, refetch } = useLevels(filters);
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
      <Card title="Elementos por nivel">
        <LoadingSpinner label="Cargando niveles…" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card title="Elementos por nivel">
        <ErrorMessage
          message={
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los niveles"
          }
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }

  const total = (data ?? []).reduce((sum, row) => sum + row.count, 0);
  const chartData: LevelPieRow[] = (data ?? []).map((row, index) => ({
    name: row.level ?? "Sin nivel",
    level: row.level,
    count: row.count,
    percent: total > 0 ? (row.count / total) * 100 : 0,
    fill: chartColorAt(index),
  }));

  return (
    <Card
      title="Elementos por nivel"
      className="flex h-full min-h-0 flex-col p-3"
    >
      {chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Sin datos de niveles
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
                  outerRadius="80%"
                  shape={(props: PieSectorShapeProps) => (
                    <ColoredPieSector
                      {...props}
                      activeLevel={activeLevel}
                      hasLevelFilter={hasLevelFilter}
                    />
                  )}
                  isAnimationActive={entranceDone ? false : "auto"}
                  onAnimationEnd={() => setEntranceDone(true)}
                  cursor={onSelectLevel ? "pointer" : undefined}
                  onClick={(_, index) => {
                    const row = chartData[index];
                    if (row && onSelectLevel) {
                      onSelectLevel(row.level);
                    }
                  }}
                />
                <Tooltip content={<LevelTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <LevelLegend
            items={chartData}
            activeLevel={activeLevel}
            hasLevelFilter={hasLevelFilter}
            onSelectLevel={onSelectLevel}
          />
        </div>
      )}
    </Card>
  );
}
