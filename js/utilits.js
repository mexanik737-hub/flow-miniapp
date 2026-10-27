/**
 * Всплывающее системное уведомление (Toast)
 */
function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerText = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

/**
 * Переключение выпадающих селектов
 */
function toggleDropdown(boxId) {
  const el = document.getElementById(boxId);
  if (!el) return;
  const wasOpen = el.classList.contains('open');
  document.querySelectorAll('.custom-select-box').forEach(b => b.classList.remove('open'));
  if (!wasOpen) el.classList.add('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-box')) {
    document.querySelectorAll('.custom-select-box').forEach(b => b.classList.remove('open'));
  }
});

/**
 * Универсальный переключатель чекбоксов
 */
function toggleCheckbox(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const isChecked = el.classList.contains('checked');
  el.classList.toggle('checked', !isChecked);
  el.innerText = !isChecked ? '✓' : '';
}

/**
 * Парсер даты заказа из строки в миллисекунды для таймеров
 */
function parseOrderDateToTs(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{2}):(\d{2})\s(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) {
    const [_, h, m, day, mon, yr] = match;
    return new Date(yr, mon - 1, day, h, m).getTime();
  }
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Естественная сортировка чисел и строк для ростовок (40 см, 50 см, 60 см) и фасовок
 */
function sortAscendingValues(arr) {
  return arr.sort((a, b) => {
    const numA = parseInt(String(a).match(/\d+/)?.[0] || 0, 10);
    const numB = parseInt(String(b).match(/\d+/)?.[0] || 0, 10);
    if (numA !== numB) {
      return numA - numB;
    }
    return String(a).localeCompare(String(b), 'ru', { numeric: true });
  });
}

/**
 * Расчет прямого расстояния между двумя гео-координатами по формуле гаверсинусов (в км)
 */
function calcHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
