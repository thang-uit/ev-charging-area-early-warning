const MAP_WIDTH = 760;
const MAP_HEIGHT = 420;
const MAP_PADDING = 28;

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

  const gridLines = [0.25, 0.5, 0.75].map((ratio) => `<line class="map-grid-line" x1="${MAP_PADDING}" y1="${MAP_PADDING + ratio * (MAP_HEIGHT - MAP_PADDING * 2)}" x2="${MAP_WIDTH - MAP_PADDING}" y2="${MAP_PADDING + ratio * (MAP_HEIGHT - MAP_PADDING * 2)}"/>`).join('');
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

  element.innerHTML = `<svg viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" role="img" aria-label="Charging area locations around Shenzhen"><defs><filter id="mapGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="mapWash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--map-wash-a)"/><stop offset="1" stop-color="var(--map-wash-b)"/></linearGradient></defs><rect class="map-surface" x="0" y="0" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" rx="16"/><path class="map-terrain" d="M45 324 C135 278 160 308 230 260 S340 272 396 228 S520 248 585 190 S684 170 722 108 L760 0 L0 0 L0 390 Z"/><path class="map-river" d="M0 110 C90 150 125 112 216 150 S360 210 450 174 S602 114 760 148"/><path class="map-river-secondary" d="M0 182 C102 204 160 190 256 222 S408 270 520 230 S648 206 760 244"/>${gridLines}<g class="map-points">${points}</g>${selectedRing}<text class="map-label map-label-east" x="${MAP_WIDTH - 92}" y="${MAP_HEIGHT - 18}">EAST</text><text class="map-label map-label-north" x="${MAP_PADDING}" y="${MAP_PADDING - 8}">NORTH</text></svg>`;
}
