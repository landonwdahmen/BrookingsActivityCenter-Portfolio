document.addEventListener('DOMContentLoaded', function () {
    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        events: '/schedule', // Endpoint to fetch events
        eventClick: function (info) {
            // Display information about the clicked event
            var eventInfo = 'Event: ' + info.event.title + '\nDate: ' + info.event.start + '\nEvent Duration(hrs): ' + info.event.extendedProps.eventDuration + '\nParty Size: ' + info.event.extendedProps.partySize +
            '\nEvent Description: ' + info.event.extendedProps.eventDescription + '\nCatering Needed: ' + info.event.extendedProps.cateringCheck + '\nEquipment Needed: ' + info.event.extendedProps.equipmentCheck;

            // If eventCooks information is available, append it to event information
            if (info.event.extendedProps.cateringCheck) {
                eventInfo += '\nAssigned Cooks:\n';
                info.event.extendedProps.eventCooks.forEach(cook => {
                    eventInfo += '- ' + cook + '\n';
                });
            }

            // If eventStaff information is available, append it to event information
            if (info.event.extendedProps.eventStaff) {
                eventInfo += '\nAssigned Event Staff:\n';
                info.event.extendedProps.eventStaff.forEach(staff => {
                    eventInfo += '- ' + staff + '\n';
                });
            }

            alert(eventInfo); // Display event information with assigned cooks and staff
        }
    });

    fetch('/schedule')
    .then(response => response.json())
    .then(events => {
        console.log("Fetched Events:", events);
        events.forEach(event => {
            // Concatenate date and time strings retrieved from the server
            var startDateTime = event.event_date + 'T' + event.event_time + ':00'; // Assuming both fields are in compatible formats
            calendar.addEvent({
                title: event.event_name,
                start: startDateTime, // Concatenated datetime string
                extendedProps: {
                    partySize: event.party_size,
                    eventDuration: event.event_duration,
                    eventDescription: event.description_info,
                    cateringCheck: event.cateringcheckbox,
                    equipmentCheck: event.equipmentcheckbox,
                    eventCooks: event.availableCooks, // Include available cooks for the event
                    eventStaff: event.availableStaff // Include available event staff for the event
                }
            });
        });
    })
    .catch(error => {
        console.error('Error fetching events:', error);
    });

    calendar.render();
});


document.addEventListener("DOMContentLoaded", function() {
    var workScheduleLink = document.getElementById("workScheduleLink");
    var workScheduleSubMenu = document.getElementById("workScheduleSubMenu");
  
    workScheduleLink.addEventListener("click", function(event) {
      event.preventDefault(); // Prevent default action of link
      if (workScheduleSubMenu.style.display === "none") {
        workScheduleSubMenu.style.display = "block";
      } else {
        workScheduleSubMenu.style.display = "none";
      }
    });
  });



  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('userId');

  // Modifying the link to viewSchedule.html to include the userId parameter
  const logAvailabilituy = document.querySelector('a[href="employee.html"]');
  if (logAvailabilituy) {
    logAvailabilituy.href = `employee.html?userId=${userId}`;
  }