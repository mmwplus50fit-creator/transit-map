export function normalizeFeed(feed, now = Date.now()) {
  const timestamp = Number(feed.header?.timestamp || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Missing feed timestamp');
  const vehicles = [];
  for (const entity of feed.entity || []) {
    const v = entity.vehicle, p = v?.position;
    if (!v || entity.isDeleted || !p) continue;
    const lat = Number(p.latitude), lon = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 43 || lat > 45 || lon < -81 || lon > -78) continue;
    const reported = Number(v.timestamp || 0);
    vehicles.push({ id: String(v.vehicle?.id || entity.id), route: String(v.trip?.routeId || ''),
      trip: String(v.trip?.tripId || ''), lat, lon, bearing: p.bearing ?? null,
      timestamp: reported > 0 ? reported : null, stop: String(v.stopId || '') });
  }
  return { source: 'TTC BusTime GTFS-Realtime', feedTimestamp: timestamp,
    fetchedAt: new Date(now).toISOString(), vehicles };
}
