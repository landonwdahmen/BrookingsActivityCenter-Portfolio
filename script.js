const eventForm = document.getElementById('eventForm');
const equipmentSelect = document.getElementById('equipmentCheckbox');
function updateEquipment() {
  const needed = equipmentSelect.value === 'yes';
  document.getElementById('equipmentSection').style.display = needed ? 'block' : 'none';
  for (const id of ['chairsAmount', 'tablesAmount']) document.getElementById(id).disabled = !needed;
}
equipmentSelect.addEventListener('change', updateEquipment);
updateEquipment();
eventForm.addEventListener('submit', event => {
  const data = new FormData(eventForm);
  const time = data.get('eventTime');
  if (time >= '03:00' && time < '05:00') {
    event.preventDefault();
    alert('Events cannot start between 3 am and 5 am.');
    return;
  }
  if (!eventForm.querySelector('input[name^="room"]:checked')) {
    event.preventDefault();
    alert('Select at least one room.');
    return;
  }
  const message = ['Submit this event request?',
    'Event: ' + data.get('eventName'), 'Date/time: ' + data.get('eventDate') + ' ' + time,
    'Duration (hours): ' + data.get('eventDuration'), 'Party size: ' + data.get('partySize'),
    'Description: ' + data.get('description_info'), 'Catering: ' + data.get('cateringCheckbox'),
    'Equipment: ' + data.get('equipmentCheckbox')].join('\n');
  // Let the browser submit once; Cancel prevents the native form submission.
  if (!window.confirm(message)) event.preventDefault();
});
if (new URLSearchParams(location.search).get('submitted') === '1') {
  document.getElementById('submissionStatus').textContent = 'Event request saved.';
}
