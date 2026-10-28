function toast(text) {
  const el = document.getElementById('toast');
  el.innerText = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}


function toggleDropdown(boxId) {
  const el = document.getElementById(boxId);
  const wasOpen = el.classList.contains('open');
  document.querySelectorAll('.custom-select-box').forEach(b => b.classList.remove('open'));
  if (!wasOpen) el.classList.add('open');
}


document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-box')) {
    document.querySelectorAll('.custom-select-box').forEach(b => b.classList.remove('open'));
  }
});


function toggleCheckbox(elId) {
  const el = document.getElementById(elId);
  const isChecked = el.classList.contains('checked');
  el.classList.toggle('checked', !isChecked);
  el.innerText = !isChecked ? '✓' : '';
}


function toggleOrderSaveAddressCheckbox() {
  ordSaveAddrChecked = !ordSaveAddrChecked;
  const el = document.getElementById('ord-save-addr-checkbox-ui');
  el.classList.toggle('checked', ordSaveAddrChecked);
  el.innerText = ordSaveAddrChecked ? '✓' : '';
}


function toggleCartAssemblyMode() {
  isAssemblyMode = !isAssemblyMode;
  const el = document.getElementById('cart-assembly-checkbox-ui');
  el.classList.toggle('checked', isAssemblyMode);
  el.innerText = isAssemblyMode ? '✓' : '';
  renderCartItems();
}


function bindPhoneMask(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    let val = input.value.replace(/\D/g, '');
    if (val.startsWith('7') || val.startsWith('8')) val = val.substring(1);
    val = val.substring(0, 10);
    let res = "8";
    if (val.length > 0) res += " (" + val.substring(0, 3);
    if (val.length >= 4) res += ") " + val.substring(3, 6);
    if (val.length >= 7) res += "-" + val.substring(6, 8);
    if (val.length >= 9) res += "-" + val.substring(8, 10);
    input.value = res;
  });
}
bindPhoneMask(document.getElementById('reg-phone'));
bindPhoneMask(document.getElementById('edit-prof-phone'));
bindPhoneMask(document.getElementById('ord-rec-phone'));


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


function calcHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}


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


// Универсальный шаблон форматирования: Товар [штук] [см] [цвет]
function formatItemFullName(title, unit, variant, color) {
  let res = String(title || "").trim();
  if (unit && String(unit).trim()) {
    res += ` [${String(unit).trim()}]`;
  }
  if (variant && String(variant).trim()) {
    res += ` [${String(variant).trim()}]`;
  }
  if (color && String(color).trim()) {
    res += ` [${String(color).trim()}]`;
  }
  return res;
}
