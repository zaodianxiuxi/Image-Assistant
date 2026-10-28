/** Keep crossovers in the space below each picture, with distance-based progress. */
export function buildJourneyRoute(points) {
  if (points.length < 2) return { path: '', progress: points.map(() => 0) };
  let path = 'M ' + points[0].x + ' ' + points[0].y;
  let total = 0;
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const exit = Math.max(a.y, Math.min(a.exitY, b.y));
    const middle = (exit + b.y) / 2;
    path += ' L ' + a.x + ' ' + exit + ' C ' + a.x + ' ' + middle + ', ' + b.x + ' ' + middle + ', ' + b.x + ' ' + b.y;
    total += exit - a.y;
    // Sample the cubic for consistent progress when images and version panels differ in height.
    let previous = { x: a.x, y: exit };
    for (let sample = 1; sample <= 48; sample++) {
      const t = sample / 48, u = 1 - t;
      const point = { x: (u*u*u + 3*u*u*t)*a.x + (3*u*t*t + t*t*t)*b.x, y: u*u*u*exit + 3*u*u*t*middle + 3*u*t*t*middle + t*t*t*b.y };
      total += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
    lengths.push(total);
  }
  return { path, progress: lengths.map(length => total ? length / total : 0) };
}
