export async function loadDemoData() {
  const response = await fetch('./data/demo.json');
  if (!response.ok) throw new Error(`Demo data request failed: ${response.status}`);
  return response.json();
}

export function formatPercent(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

export function formatDate(value, language = 'vi') {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}
