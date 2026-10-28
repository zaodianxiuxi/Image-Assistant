/** Uses normalized gallery groups; their images are already newest-first. */
export function buildGalleryJourney(group) {
  const steps = [];
  const unsequenced = [];
  for (const node of group.nodes) {
    if (!node.items.length) continue;
    if (node.nodeId === null || !Number.isFinite(node.nodeOrder)) {
      unsequenced.push(...node.items);
      continue;
    }
    const item = node.items.find(image => image.isDelivery === true) || node.items[0];
    steps.push({ key: node.key, title: node.title, order: node.nodeOrder, item, alternatives: node.items.filter(image => image !== item) });
  }
  steps.sort((a, b) => a.order - b.order);
  return { steps, unsequenced };
}
