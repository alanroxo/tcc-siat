    document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'pt-br',
    selectable: true,
    dateClick: function(info) {
      let eventTitle = prompt('Digite o título do evento:');
      if (eventTitle) {
        calendar.addEvent({
          title: eventTitle,
          start: info.dateStr,
          allDay: true
        });
      }
    }
  });
  calendar.render();

  calendarEl.addEventListener('click', () => {
    calendarEl.classList.toggle('expanded');
    calendar.updateSize();
  });
});
