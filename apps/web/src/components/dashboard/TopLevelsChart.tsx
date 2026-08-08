import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  Tooltip,
  Treemap,
  type TreemapNode,
} from "recharts";

import { useLevels } from "../../hooks/useFacets";
import type { OverviewCrossFilter } from "../../hooks/useOverviewCrossFilter";
import { Card } from "../ui/Card";
import { ErrorMessage } from "../ui/ErrorMessage";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { chartColorAt } from "./chartPalette";
import {
  OTHERS_FILL,
  TOP_N,
  topNWithOthers,
} from "./topNWithOthers";

type LevelTreeLeaf = {
  name: string;
  size: number;
  percent: number;
  level: string | null;
  isOthers: boolean;
  othersCount?: number;
  fill: string;
};

type TopLevelsChartProps = {
  filters?: OverviewCrossFilter;
  activeLevel?: string | null;
  onSelectLevel?: (level: string | null) => void;
  hasLevelFilter?: boolean;
};

type TreemapContentProps = TreemapNode & {
  activeLevel?: string | null;
  hasLevelFilter?: boolean;
  onSelectLevel?: (level: string | null) => void;
};

function LevelTreemapContent(props: TreemapContentProps) {
  const {
    x,
    y,
    width,
    height,
    depth,
    index,
    name,
    activeLevel,
    hasLevelFilter,
    onSelectLevel,
  } = props;

  // Flat list → only leaf depth renders tiles.
  if (depth !== 1 || width <= 0 || height <= 0) {
    return null;
  }

  const leaf = props as TreemapNode & Partial<LevelTreeLeaf>;
  const isOthers = leaf.isOthers === true;
  const level = isOthers ? null : ((leaf.level as string | null | undefined) ?? null);
  const fill =
    typeof leaf.fill === "string"
      ? leaf.fill
      : isOthers
        ? OTHERS_FILL
        : chartColorAt(typeof index === "number" ? index : 0);

  const isActive =
    hasLevelFilter === true &&
    !isOthers &&
    ((level === null && activeLevel === null) || level === activeLevel);
  const opacity = !hasLevelFilter || isActive || isOthers ? 1 : 0.35;

  const showLabel = width > 48 && height > 28;
  const showCount = width > 56 && height > 42;
  const sizeValue =
    typeof leaf.size === "number"
      ? leaf.size
      : typeof leaf.value === "number"
        ? leaf.value
        : undefined;

  const handleClick = () => {
    if (!onSelectLevel || isOthers) {
      return;
    }
    onSelectLevel(level);
  };

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={2}
        ry={2}
        style={{
          fill,
          fillOpacity: opacity,
          stroke: "#fff",
          strokeWidth: 2,
          cursor: onSelectLevel && !isOthers ? "pointer" : "default",
        }}
        onClick={handleClick}
      />
      {showLabel ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showCount ? -4 : 4)}
          textAnchor="middle"
          fill="#fff"
          fontSize={11}
          style={{
            pointerEvents: "none",
            fontWeight: "normal",
            fontFamily: "inherit",
          }}
        >
          {name}
        </text>
      ) : null}
      {showLabel && showCount && sizeValue !== undefined ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          fill="#fff"
          fontSize={10}
          fillOpacity={0.9}
          style={{
            pointerEvents: "none",
            fontWeight: "normal",
            fontFamily: "inherit",
          }}
        >
          {sizeValue}
        </text>
      ) : null}
    </g>
  );
}

function LevelTreemapTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: LevelTreeLeaf & TreemapNode }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row || row.depth === 0) {
    return null;
  }
  const count = row.size ?? row.value;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-normal text-gray-900">{row.name}</p>
      <p className="text-gray-600">
        {count}
        {typeof row.percent === "number"
          ? ` (${row.percent.toFixed(1)}%)`
          : ""}
      </p>
      {row.isOthers && row.othersCount ? (
        <p className="mt-1 text-xs text-gray-400">
          {row.othersCount} niveles agrupados
        </p>
      ) : null}
    </div>
  );
}

export function TopLevelsChart({
  filters = {},
  activeLevel,
  onSelectLevel,
  hasLevelFilter = false,
}: TopLevelsChartProps) {
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
      <Card title="Top niveles">
        <LoadingSpinner label="Cargando niveles…" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card title="Top niveles">
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

  const named = (data ?? []).map((row) => ({
    name: row.level ?? "Sin nivel",
    count: row.count,
    level: row.level,
  }));
  const { chartRows: baseRows, totalNames } = topNWithOthers(
    named.map(({ name, count }) => ({ name, count })),
  );

  const treeData: LevelTreeLeaf[] = baseRows.map((row, index) => {
    if (row.isOthers) {
      return {
        name: row.name,
        size: row.count,
        percent: row.percent,
        level: null,
        isOthers: true,
        othersCount: row.othersCount,
        fill: OTHERS_FILL,
      };
    }
    const source = named.find((n) => n.name === row.name);
    return {
      name: row.name,
      size: row.count,
      percent: row.percent,
      level: source?.level ?? null,
      isOthers: false,
      fill: chartColorAt(index),
    };
  });

  const shownNamed = Math.min(TOP_N, totalNames);
  const subtitle =
    totalNames > TOP_N
      ? `Top ${shownNamed} de ${totalNames} + Otros`
      : `${totalNames} niveles`;

  return (
    <Card
      title="Top niveles"
      subtitle={subtitle}
      className="flex h-full min-h-0 flex-col p-3"
    >
      {treeData.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Sin datos de niveles
        </p>
      ) : (
        <div className="h-[200px] w-full min-w-0 min-h-0 flex-1 lg:h-auto [&_text]:font-normal">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treeData}
              dataKey="size"
              nameKey="name"
              aspectRatio={4 / 3}
              stroke="#fff"
              isAnimationActive={entranceDone ? false : "auto"}
              onAnimationEnd={() => setEntranceDone(true)}
              content={(nodeProps: TreemapNode) => (
                <LevelTreemapContent
                  {...nodeProps}
                  activeLevel={activeLevel}
                  hasLevelFilter={hasLevelFilter}
                  onSelectLevel={onSelectLevel}
                />
              )}
            >
              <Tooltip content={<LevelTreemapTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
