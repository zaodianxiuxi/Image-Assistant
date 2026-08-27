function localGroupId(result) {
  return `local-group-${result.seriesId ?? "standalone"}-${result.nodeId ?? result.id}`;
}

export function enrichSessionVersion(result, parent = null) {
  if (result?.versionId) return { ...result };
  const versionGroupId = parent?.versionGroupId ?? result?.versionGroupId ?? localGroupId(result);
  const versionNumber = Number(parent?.versionNumber || result?.versionNumber || 0) + 1;
  return {
    ...result,
    versionGroupId,
    versionId: `local-version-${versionGroupId}-${versionNumber}`,
    parentVersionId: parent?.versionId ?? result?.parentVersionId ?? null,
    versionNumber,
    isDelivery: false
  };
}

export function markSessionDelivery(items, versionId) {
  const list = Array.isArray(items) ? items : [];
  const selected = list.find((item) => item.versionId === versionId);
  if (!selected) return list.map((item) => ({ ...item }));
  return list.map((item) => String(item.versionGroupId) === String(selected.versionGroupId)
    ? { ...item, isDelivery: item.versionId === versionId }
    : { ...item });
}
