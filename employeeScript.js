function getDatesForUpcomingWeek(today = new Date()) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // The next Monday: Sunday advances one day; Monday advances seven.
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    return date;
  });
}
const dateSelect = document.getElementById('dateSelect');
for (const date of getDatesForUpcomingWeek()) {
  const option = document.createElement('option');
  option.value = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  option.textContent = date.toDateString();
  dateSelect.appendChild(option);
}
document.getElementById('availabilityForm').addEventListener('submit', event => {
  const shifts = [1, 2, 3].map(n => document.getElementById('shift' + n + 'Dropdown').value);
  if (!window.confirm('Save availability for ' + dateSelect.value + '?\n' + shifts.map((value, i) => 'Shift ' + (i + 1) + ': ' + value).join('\n'))) event.preventDefault();
});
document.getElementById('workScheduleLink').addEventListener('click', event => {
  event.preventDefault();
  const menu = document.getElementById('workScheduleSubMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
});
if (new URLSearchParams(location.search).get('submitted') === '1') {
  document.getElementById('submissionStatus').textContent = 'Availability saved.';
}
