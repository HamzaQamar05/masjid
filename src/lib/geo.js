export function distanceText(item) {
  if (item.distanceKm == null) return item.address || item.location || item.city ? 'Enable location for distance' : 'Location not added';
  return `${item.distanceKm.toFixed ? item.distanceKm.toFixed(1) : item.distanceKm} km away`;
}

export function distanceKmBetween(origin, item) {
  const originLat = Number(origin?.latitude);
  const originLng = Number(origin?.longitude);
  const itemLat = Number(item?.latitude);
  const itemLng = Number(item?.longitude);
  if (![originLat, originLng, itemLat, itemLng].every(Number.isFinite)) return null;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(itemLat - originLat);
  const dLng = toRad(itemLng - originLng);
  const lat1 = toRad(originLat);
  const lat2 = toRad(itemLat);
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
