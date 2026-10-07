// Presentation only: preserve the stored statistics and their raw-ID evidence.
export function militaryReviewData(military) {
  const summary = military.composition?.rawUnitQueueSummary;
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return military;
  const entries = Object.entries(summary).sort(([a], [b]) => Number(a) - Number(b));
  return {
    ...military,
    composition: {
      ...military.composition,
      rawUnitQueueSummary: entries.length
        ? entries.map(([id, value]) => `ID ${id}: ${value}`).join('\n')
        : 'None observed',
    },
  };
}
