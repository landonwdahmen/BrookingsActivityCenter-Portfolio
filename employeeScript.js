function getDatesForUpcomingWeek() {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + 8); // Add 8 to go to the next Monday
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        weekDates.push(date.toDateString());
    }
    return weekDates;
}

// Function to populate the select dropdown with dates
function populateDatesSelect() {
    const dates = getDatesForUpcomingWeek();
    const select = document.getElementById("dateSelect");
    dates.forEach(date => {
        const option = document.createElement("option");
        option.value = date; 
        option.textContent = date;
        select.appendChild(option);
    });
}

// Function to set the selected date value in the hidden input field
function setSelectedDate() {
    const dateSelect = document.getElementById("dateSelect");
    const selectedDate = document.getElementById("selectedDate");
    selectedDate.value = dateSelect.value;
}

// Call the function to populate the select dropdown
populateDatesSelect();

// Event listener to update the hidden input field when the date selection changes
document.getElementById("dateSelect").addEventListener("change", setSelectedDate);




function validateAvailabilityForm() {
    // Get form data
    var formData = getFormData();

    // Perform validation
    if (!formData.selectedDate) {
        alert("Please select a date.");
        return false;
    }

    if (formData.shift1Dropdown === "Blank" || formData.shift2Dropdown === "Blank" || formData.shift3Dropdown === "Blank") {
        alert("Please select availability for all shifts.");
        return false;
    }

    // Validation passed
    return true;
}




function displayConfirmationBox() {
    var formData = getFormData();
    var selectedDate = document.getElementById("selectedDate").value;

    var confirmationMessage = 'selectedDate: ' + formData.selectedDate + '\n' +
                              'shift1Dropdown: ' + formData.shift1Dropdown + '\n' +
                              'shift2Dropdown: ' + formData.shift2Dropdown + '\n' +
                              'shift3Dropdown: ' + formData.shift3Dropdown;

    var userConfirmed = window.confirm(confirmationMessage);

    if (userConfirmed) {
        // Prevent default form submission action
        event.preventDefault();
        document.getElementById('availabilityForm').submit();
    }
    else {
        // If user clicks Cancel, do nothing
        return false;
    }
}



function getFormData() {
    var formData = {};
    

    
    formData.selectedDate = document.getElementById("selectedDate").value;
    formData.shift1Dropdown = document.getElementById('shift1Dropdown').value;
    formData.shift2Dropdown = document.getElementById('shift2Dropdown').value;
    formData.shift3Dropdown = document.getElementById('shift3Dropdown').value;
    
    return formData;
}




document.getElementById('availabilityForm').addEventListener('submit', function (event) {
    // Validate the form
    var isValid = validateAvailabilityForm();

    // If the form is valid, display the confirmation box
    if (isValid) {
        // Display confirmation box
        var confirmed = displayConfirmationBox();

        // If the user confirmed, proceed with form submission
        if (!confirmed) {
            // Prevent default form submission action
            event.preventDefault();
        }
    } else {
        // Prevent default form submission action if form is not valid
        event.preventDefault();
    }
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
  

