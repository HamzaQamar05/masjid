export function distanceText(item) {
  if (item.distanceKm == null) return 'Distance unavailable';
  return `${item.distanceKm.toFixed ? item.distanceKm.toFixed(1) : item.distanceKm} km away`;
}

export function distanceKmBetween(origin, item) {
  if (!origin?.latitude || !origin?.longitude || !item?.latitude || !item?.longitude) return null;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(Number(item.latitude) - Number(origin.latitude));
  const dLng = toRad(Number(item.longitude) - Number(origin.longitude));
  const lat1 = toRad(Number(origin.latitude));
  const lat2 = toRad(Number(item.latitude));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const distanceKm = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null;
}

export function withLocalDistance(items = [], origin) {
  return [...items].map((item) => {
    const distanceKm = item.distanceKm ?? distanceKmBetween(origin, item);
    if (distanceKm == null) return item;
    return {
      ...item,
      distanceKm,
      walkingMinutes: item.walkingMinutes ?? Math.max(3, Math.round((distanceKm / 5) * 60)),
      drivingMinutes: item.drivingMinutes ?? Math.max(2, Math.round((distanceKm / 35) * 60))
    };
  }).sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY));
}
