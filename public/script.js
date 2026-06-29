document.addEventListener('DOMContentLoaded', function () {
  fetch('/api/opportunities')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data || !Array.isArray(data.opportunities)) {
        throw new Error('Expected an array of opportunities, but received:', data);
      }

      const timeslots = data.timeslots.map(timeslot => ({
        title: timeslot.Name,
        allDay: false,
        start: timeslot.goldenapp__Start__c,
        end: timeslot.goldenapp__End__c,
        type: 'volunteer'
      }));

      const events = data.opportunities.map(opportunity => ({
        title: opportunity.Name,
        allDay: false,
        start: opportunity.Event_Start_Date_Time__c,
        end: opportunity.Event_End_Date_Time__c,
        type: opportunity.Type
      }));

      const allMappedEvents = events.concat(timeslots);

      var calendarEl = document.getElementById('calendar');
      var calendar = new FullCalendar.Calendar(calendarEl, {
        timeZone: 'Australia/Sydney',
        customButtons: {
          syncButton: {
            text: 'Refresh',
            click: function() {
              fetch('/api/sync', { method: 'POST' })
                .then(() => location.reload())
                .catch(err => console.error('Sync failed:', err));
            }
          }
        },
        headerToolbar: {
          left: 'prev,next today syncButton',
          center: 'title',
          right: 'dayGridWeek,timeGridDay'
        },
        views: {
          timeGridDay: {
            titleFormat: function(info) {
              var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              var dayName = days[info.date.marker.getUTCDay()];
              var dayNum = info.date.day;
              var month = info.date.month + 1;
              return dayName + ' - ' + dayNum + '/' + month;
            }
          }
        },
        navLinks: true,
        initialView: 'timeGridDay',
        nowIndicator: true,
        events: allMappedEvents,
        slotMinTime: '06:00:00',
        scrollTime: '07:00:00',
        eventClick: function(info) {
          document.getElementById("side-nav").style.display = "block";
          const h1 = document.querySelector("h1");
          h1.innerText = info.event.title;

          var eventspec = document.getElementById("typedial");
          eventspec.classList.remove('Corporate-Event', 'School-Program', 'Cooking-with-Family', 
            'Birthday-Party', 'OBK-Catering', 'volunteer', 'Jewish-Holiday');

          const eventTypeClass = info.event.extendedProps.type.replace(/\s+/g, '-');
          eventspec.classList.add(eventTypeClass);

          const typeText = document.getElementById("type-text");
          typeText.innerText = eventTypeClass;
        },
        eventClassNames: function (arg) {
          if (arg.event.extendedProps && arg.event.extendedProps.type) {
            return 'event-type-' + arg.event.extendedProps.type.replace(/\s+/g, '-');
          }
          return '';
        },
        eventDidMount: function(info) {
          // If this is a Jewish holiday, mark ALL days in the holiday range as blocked
          if (info.event.extendedProps.type === 'Jewish Holiday') {
            const startDate = new Date(info.event.start);
            const endDate = new Date(info.event.end);
            
            // Generate all dates in the holiday range
            const holidayDates = [];
            const currentDate = new Date(startDate);
            
            while (currentDate <= endDate) {
              holidayDates.push(currentDate.toISOString().split('T')[0]);
              currentDate.setDate(currentDate.getDate() + 1);
            }
            
            // Find and mark ALL day columns/cells for the entire holiday duration
            setTimeout(() => {
              holidayDates.forEach(dateStr => {
                // Day view - timegrid columns
                const dayColumns = document.querySelectorAll('.fc-timegrid-col');
                dayColumns.forEach(col => {
                  const colDate = col.getAttribute('data-date');
                  if (colDate === dateStr) {
                    col.classList.add('jewish-holiday-day');
                  }
                });
                
                // Week view - daygrid day cells
                const dayCells = document.querySelectorAll('.fc-daygrid-day');
                dayCells.forEach(cell => {
                  const cellDate = cell.getAttribute('data-date');
                  if (cellDate === dateStr) {
                    cell.classList.add('jewish-holiday-day');
                  }
                });
              });
            }, 10);
          }
        }
      });
      calendar.render();
      
      // Add visual blocking for entire days with Jewish holidays
      setTimeout(() => {
        // Find all Jewish holiday events
        const jewishHolidayEvents = allMappedEvents.filter(event => event.type === 'Jewish Holiday');
        
        jewishHolidayEvents.forEach(event => {
          const eventDate = new Date(event.start);
          const dateStr = eventDate.toISOString().split('T')[0]; // Get YYYY-MM-DD format
          
          // Find the corresponding day column and add blocking class
          const dayColumns = document.querySelectorAll('.fc-timegrid-col[data-date="' + dateStr + '"]');
          dayColumns.forEach(col => {
            col.classList.add('jewish-holiday-day');
          });
          
          // Also handle data-date attributes that might be formatted differently
          const dayElements = document.querySelectorAll('.fc-timegrid-col');
          dayElements.forEach(col => {
            const colDate = col.getAttribute('data-date');
            if (colDate && colDate === dateStr) {
              col.classList.add('jewish-holiday-day');
            }
          });
        });
      }, 100); // Small delay to ensure calendar is fully rendered
    })
    .catch(error => {
      console.error('Error fetching data:', error);
    });
});

function close_window() {
  document.getElementById("side-nav").style.display = "none";
} 