document.addEventListener('DOMContentLoaded', () => {
  initializeCalendar();
  document.getElementById('workScheduleLink').addEventListener('click', event => {
    event.preventDefault();
    const menu = document.getElementById('workScheduleSubMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });
});
