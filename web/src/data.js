export async function loadDemoData() {
  const [demoResponse, zonesResponse] = await Promise.all([
    fetch('./data/demo.json'),
    fetch('./data/zones.json'),
  ]);
  if (!demoResponse.ok) throw new Error(`Demo data request failed: ${demoResponse.status}`);
  if (!zonesResponse.ok) throw new Error(`Zone data request failed: ${zonesResponse.status}`);
  const [demo, zones] = await Promise.all([demoResponse.json(), zonesResponse.json()]);
  return { ...demo, zones };
}

export function formatPercent(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

export function formatDate(value, language = 'vi') {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}
