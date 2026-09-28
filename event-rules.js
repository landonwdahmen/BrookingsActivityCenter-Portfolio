// Rules grounded in the academic forms; no room-conflict or assignment policy.
const roomFields = ['roomConventionCenter', 'roomConventionCenterA', 'roomConventionCenterB',
  'roomBallroom', 'roomBallroomA', 'roomBallroomB', 'roomTheater'];

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function integer(value, min) {
  return (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) &&
    Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= 2147483647;
}
function validateEvent(body) {
  for (const [key, max] of Object.entries({ contactName: 255, contactEmail: 255, contactPhone: 20, eventName: 255, description_info: 255 })) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > max) return `Invalid ${key}`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail.trim())) return 'Invalid contactEmail';
  if (!integer(body.partySize, 1) || !integer(body.eventDuration, 1)) return 'Party size and duration must be positive whole numbers';
  if (!validDate(body.eventDate) || typeof body.eventTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.eventTime)) return 'Invalid event date/time';
  const end = new Date(body.eventDate + 'T' + body.eventTime + ':00Z');
  end.setUTCHours(end.getUTCHours() + Number(body.eventDuration));
  if (!Number.isFinite(end.getTime()) || end.getUTCFullYear() > 9999) return 'Event end is outside the supported calendar date range';
  // Existing script.js disallowed event start times between 03:00 and 05:00.
  if (body.eventTime >= '03:00' && body.eventTime < '05:00') return 'Events cannot start between 03:00 and 05:00';
  if (!['yes', 'no'].includes(body.cateringCheckbox) || !['yes', 'no'].includes(body.equipmentCheckbox)) return 'Select Yes or No for catering and equipment';
  if (body.equipmentCheckbox === 'yes' &&
      (!integer(body.chairsAmount === '' || body.chairsAmount === undefined ? 0 : body.chairsAmount, 0) ||
       !integer(body.tablesAmount === '' || body.tablesAmount === undefined ? 0 : body.tablesAmount, 0))) return 'Equipment quantities must be nonnegative whole numbers';
  for (const field of roomFields) {
    if (body[field] !== undefined && body[field] !== 'on' && body[field] !== true && body[field] !== false) return 'Invalid room selection';
  }
  if (!roomFields.some(field => body[field] === 'on' || body[field] === true)) return 'Select at least one room';
  return null;
}

function coveredShifts(time, duration) {
  const [hour, minute] = time.split(':').map(Number);
  const start = hour * 60 + minute;
  const end = start + Number(duration) * 60;
  // html/employee.html: 05–13, 13–21, 21–03. Overnight date ownership
  // is unspecified. Do not suggest staff for ambiguous overnight/early events.
  if (!Number.isFinite(end) || end <= start || start < 300 || end > 1440) return [];
  return [[300, 780, 'shift_1'], [780, 1260, 'shift_2'], [1260, 1440, 'shift_3']]
    .filter(([from, to]) => start < to && end > from).map(([, , field]) => field);
}

module.exports = { roomFields, validDate, validateEvent, coveredShifts };
