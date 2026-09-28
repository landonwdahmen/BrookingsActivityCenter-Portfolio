// Shared adapter: one FullCalendar instance and one event source per page.
function calendarEvent(event) {
  const start = event.event_date + 'T' + event.event_time + ':00';
  // Civil date arithmetic preserves submitted wall-clock hours without a UTC shift.
  const end = new Date(start + 'Z');
  end.setUTCHours(end.getUTCHours() + Number(event.event_duration));
  if (!Number.isFinite(end.getTime())) return false;
  return { title: event.event_name, start, end: end.toISOString().slice(0, 19),
    extendedProps: { partySize: event.party_size, eventDuration: event.event_duration,
      eventDescription: event.description_info, cateringCheck: event.cateringcheckbox,
      equipmentCheck: event.equipmentcheckbox, eventCooks: event.availableCooks, eventStaff: event.availableStaff } };
}
function initializeCalendar() {
  const calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
    initialView: 'dayGridMonth', timeZone: 'local', events: '/schedule',
    eventDataTransform: calendarEvent,
    eventSourceFailure: () => alert('Unable to load the schedule. Sign in again or retry.'),
    eventClick: info => {
      const p = info.event.extendedProps;
      alert(['Event: ' + info.event.title, 'Date: ' + info.event.start.toLocaleString(),
        'Duration (hours): ' + p.eventDuration, 'Party size: ' + p.partySize,
        'Description: ' + p.eventDescription, 'Catering: ' + (p.cateringCheck ? 'Yes' : 'No'),
        'Equipment: ' + (p.equipmentCheck ? 'Yes' : 'No'),
        'Suggested cooks: ' + ((p.eventCooks || []).join(', ') || 'None'),
        'Suggested event staff: ' + ((p.eventStaff || []).join(', ') || 'None'),
        'Suggestions are not assignments. Overnight coverage and overlapping events require manual review.'].join('\n'));
    }
  });
  calendar.render();
}
