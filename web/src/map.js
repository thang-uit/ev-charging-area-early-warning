const MAP_WIDTH = 760;
const MAP_HEIGHT = 420;
const MAP_PADDING = 34;

function projectZones(zones) {
  const longitudes = zones.map((zone) => zone.longitude);
  const latitudes = zones.map((zone) => zone.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeRange = Math.max(maxLongitude - minLongitude, 0.0001);
  const latitudeRange = Math.max(maxLatitude - minLatitude, 0.0001);

  return zones.map((zone) => ({
    ...zone,
    x: MAP_PADDING + ((zone.longitude - minLongitude) / longitudeRange) * (MAP_WIDTH - MAP_PADDING * 2),
    y: MAP_HEIGHT - MAP_PADDING - ((zone.latitude - minLatitude) / latitudeRange) * (MAP_HEIGHT - MAP_PADDING * 2),
  }));
}

function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

export function renderZoneMap(element, zones, predictions, selectedZone, selectedTime) {
  if (!element || !zones?.length) return;
  const predictionByZone = new Map(
    predictions
      .filter((row) => row.observation_time === selectedTime)
      .map((row) => [row.zone_id, row]),
  );
  // Một số bản ghi nguồn có tọa độ 0. Chúng vẫn được giữ trong CSV nhưng không thể đặt lên bản đồ.
  const mappableZones = zones.filter((zone) => zone.longitude > 0 && zone.latitude > 0);
  const projected = projectZones(mappableZones);
  const selectedIds = new Set(predictions.map((row) => row.zone_id));
  const selectedPoint = projected.find((zone) => zone.id === selectedZone);

  const gridLines = [0.2, 0.4, 0.6, 0.8].map((ratio) => {
    const x = MAP_PADDING + ratio * (MAP_WIDTH - MAP_PADDING * 2);
    const y = MAP_PADDING + ratio * (MAP_HEIGHT - MAP_PADDING * 2);
    return `<line class="map-grid-line" x1="${MAP_PADDING}" y1="${y}" x2="${MAP_WIDTH - MAP_PADDING}" y2="${y}"/><line class="map-grid-line" x1="${x}" y1="${MAP_PADDING}" x2="${x}" y2="${MAP_HEIGHT - MAP_PADDING}"/>`;
  }).join('');
  const contours = [
    '<path class="map-contour map-contour-north" d="M54 112 C170 78 272 132 384 102 S574 96 706 64"/>',
    '<path class="map-contour map-contour-major" d="M42 310 C154 258 252 316 370 282 S564 260 718 194"/>',
    '<path class="map-contour" d="M42 350 C164 302 260 356 388 324 S570 306 718 244"/>',
    '<path class="map-contour" d="M54 394 C174 350 274 398 402 362 S580 344 706 286"/>',
  ].join('');
  const points = projected.map((zone) => {
    const prediction = predictionByZone.get(zone.id);
    const isSelected = zone.id === selectedZone;
    const isExperiment = selectedIds.has(zone.id);
    const probability = prediction ? Number(prediction.lstm_probability) : 0;
    const radius = isSelected ? 9 : isExperiment ? 4.2 + Math.min(zone.capacity / 110, 3.2) : 2.25;
    const className = isSelected ? 'map-point map-point-active' : isExperiment ? 'map-point map-point-selected' : 'map-point map-point-context';
    const label = `TAZ ${zone.id}${prediction ? `, ${Math.round(probability * 100)}%` : ''}`;
    return `<circle class="${className}" cx="${zone.x.toFixed(2)}" cy="${zone.y.toFixed(2)}" r="${radius.toFixed(2)}" data-zone="${escapeAttribute(zone.id)}" data-probability="${probability.toFixed(3)}"><title>${escapeAttribute(label)}</title></circle>`;
  }).join('');
  const selectedRing = selectedPoint ? `<circle class="map-selection-ring" cx="${selectedPoint.x.toFixed(2)}" cy="${selectedPoint.y.toFixed(2)}" r="18"/>` : '';

  element.innerHTML = `<svg viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" role="img" aria-label="Charging area locations around Shenzhen"><defs><clipPath id="mapClip"><rect x="0" y="0" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" rx="18"/></clipPath><filter id="mapGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="mapWash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--map-wash-a)"/><stop offset="1" stop-color="var(--map-wash-b)"/></linearGradient></defs><rect class="map-surface" x="0" y="0" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" rx="18"/><g clip-path="url(#mapClip)"><rect class="map-wash" x="0" y="0" width="${MAP_WIDTH}" height="${MAP_HEIGHT}"/><path class="map-terrain" d="M42 302 C142 258 256 304 372 270 S566 236 718 152 L718 436 L42 436 Z"/>${gridLines}${contours}<g class="map-points">${points}</g>${selectedRing}</g><g class="map-frame"><rect x="${MAP_PADDING}" y="${MAP_PADDING}" width="${MAP_WIDTH - MAP_PADDING * 2}" height="${MAP_HEIGHT - MAP_PADDING * 2}" rx="10"/></g><text class="map-label map-label-east" x="${MAP_WIDTH - MAP_PADDING - 4}" y="${MAP_HEIGHT - 12}">EAST</text><text class="map-label map-label-north" x="${MAP_PADDING}" y="${MAP_PADDING - 10}">NORTH</text><text class="map-coordinate map-coordinate-top" x="${MAP_WIDTH - MAP_PADDING}" y="18">深圳 / AREA ATLAS</text><text class="map-coordinate map-coordinate-bottom" x="${MAP_PADDING}" y="${MAP_HEIGHT - 10}">COORDINATE VIEW · ${projected.length} MAPPABLE AREAS</text></svg>`;
}
