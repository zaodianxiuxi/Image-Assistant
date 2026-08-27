function numericValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareIds(left, right) {
  const leftNumber = numericValue(left?.id);
  const rightNumber = numericValue(right?.id);
  if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) return rightNumber - leftNumber;
  return String(right?.id || "").localeCompare(String(left?.id || ""));
}

function compareItems(left, right) {
  const timeDifference = timestamp(right?.createdAt) - timestamp(left?.createdAt);
  return timeDifference || compareIds(left, right);
}

function compareNodes(left, right) {
  const leftOrder = numericValue(left.nodeOrder);
  const rightOrder = numericValue(right.nodeOrder);
  if (leftOrder === null && rightOrder !== null) return 1;
  if (leftOrder !== null && rightOrder === null) return -1;
  if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.title.localeCompare(right.title, "zh-CN");
}

export function groupHistoryRecords(records = []) {
  const groupsByKey = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    if (!record || typeof record !== "object") continue;
    const seriesId = numericValue(record.seriesId);
    const nodeId = numericValue(record.nodeId);
    const groupKey = seriesId === null ? "other" : `series-${seriesId}`;
    let group = groupsByKey.get(groupKey);
    if (!group) {
      group = { key: groupKey, title: seriesId === null ? "其他" : String(record.seriesName || "未命名系列"), seriesId, nodes: [], latestItem: null, nodesByKey: new Map() };
      groupsByKey.set(groupKey, group);
    }

    const nodeKey = nodeId === null ? "unassigned" : `node-${nodeId}`;
    let node = group.nodesByKey.get(nodeKey);
    if (!node) {
      node = {
        key: nodeKey,
        title: nodeId === null ? "未分配节点" : String(record.nodeTitle || "未命名节点"),
        nodeId,
        nodeOrder: numericValue(record.nodeOrder),
        items: []
      };
      group.nodesByKey.set(nodeKey, node);
      group.nodes.push(node);
    }
    node.items.push({ ...record, seriesId, nodeId, nodeOrder: numericValue(record.nodeOrder) });
    if (!group.latestItem || compareItems(record, group.latestItem) < 0) group.latestItem = record;
  }

  const groups = Array.from(groupsByKey.values());
  groups.forEach((group) => {
    group.nodes.forEach((node) => node.items.sort(compareItems));
    group.nodes.sort(compareNodes);
    delete group.nodesByKey;
    delete group.latestItem;
  });
  groups.sort((left, right) => {
    if (left.key === "other" && right.key !== "other") return 1;
    if (left.key !== "other" && right.key === "other") return -1;
    const leftLatest = left.nodes.flatMap((node) => node.items).sort(compareItems)[0];
    const rightLatest = right.nodes.flatMap((node) => node.items).sort(compareItems)[0];
    return compareItems(leftLatest, rightLatest);
  });
  return groups;
}
