/** Top-N chart rows with a folded "Otros" tail (shared by category / level bars). */

export const TOP_N = 10;
export const OTHERS_LABEL = "Otros";
export const OTHERS_FILL = "#94a3b8"; // slate-400

export type NamedCount = {
  name: string;
  count: number;
};

export type TopNBarRow = {
  name: string;
  count: number;
  percent: number;
  isOthers: boolean;
  othersCount?: number;
};

/** Keep top N by count; fold the long tail into a single "Otros" bucket. */
export function topNWithOthers(
  rows: NamedCount[],
  topN: number = TOP_N,
): { chartRows: TopNBarRow[]; totalNames: number; totalElements: number } {
  const totalElements = rows.reduce((sum, row) => sum + row.count, 0);
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const head = sorted.slice(0, topN);
  const tail = sorted.slice(topN);
  const othersTotal = tail.reduce((sum, row) => sum + row.count, 0);

  const toRow = (
    name: string,
    count: number,
    extra?: Partial<TopNBarRow>,
  ): TopNBarRow => ({
    name,
    count,
    percent: totalElements > 0 ? (count / totalElements) * 100 : 0,
    isOthers: false,
    ...extra,
  });

  const chartRows: TopNBarRow[] = head.map((row) => toRow(row.name, row.count));

  if (tail.length > 0) {
    chartRows.push(
      toRow(OTHERS_LABEL, othersTotal, {
        isOthers: true,
        othersCount: tail.length,
      }),
    );
  }

  return {
    chartRows,
    totalNames: rows.length,
    totalElements,
  };
}
