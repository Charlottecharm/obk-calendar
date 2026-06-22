
serverjrhfyfkj655.js
```
const express = require('express');
const jsforce = require('jsforce');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Salesforce connection details
const conn = new jsforce.Connection({
    loginUrl: 'https://obk.my.salesforce.com' // or use the sandbox login URL if needed
});

// Serve static files (HTML, JS, CSS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to fetch Salesforce opportunities
app.get('/api/opportunities', async (req, res) => {
    try {


        // Replace this query with your actual SOQL query
        const opportunityQuery  = await conn.query("SELECT Id, Name, CloseDate, Type, Event_Start_Date_Time__c, Event_End_Date_Time__c FROM Opportunity WHERE RecordTypeId='0129q0000004JvEAAU' AND StageName = 'Confirmed'");
        const timeslotQuery = await conn.query("SELECT Id, Name, goldenapp__Start__c, goldenapp__End__c FROM goldenapp__Volunteer_Opportunity_Timeslot__c");
        
        console.log('Opportunities:', opportunityQuery);
        console.log('Opp Timeslots:', timeslotQuery);
          
        res.json({
            opportunities: opportunityQuery.records,
            timeslots: timeslotQuery.records
        });
    } catch (error) {
        console.error('Salesforce API request error:', error.message);
        res.status(500).send('Error');
    }

}
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});


```



```server.js

const express = require('express');
const jsforce = require('jsforce');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Salesforce connection details
const conn = new jsforce.Connection({
    loginUrl: 'https://obk--sfcalendar.sandbox.my.salesforce.com' // or use the sandbox login URL if needed
});

// Serve static files (HTML, JS, CSS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to fetch Salesforce opportunities
app.get('/api/opportunities', async (req, res) => {


        // Replace this query with your actual SOQL query
        const opportunityQuery  = await conn.query("SELECT Id, Name, CloseDate, Type, Event_Start_Date_Time__c, Event_End_Date_Time__c FROM Opportunity WHERE RecordTypeId='0129q0000004JvEAAU'");
        const timeslotQuery = await conn.query("SELECT Id, Name FROM goldenapp__Volunteer_Opportunity_Timeslot__c");
        
        console.log('Opportunities:', opportunityQuery);
        console.log('Opp Timeslots:', timeslotQuery);
        
           
           res.json({
            opportunities: opportunityQuery.records,
            timeslots: timeslotQuery.records
        });
        
    } catch (error) {
        console.error('Salesforce API request error:', error.message);
        res.status(500).send('Error');
         }
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
```



index.html
```
<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="robots" content="noindex"> 
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Salesforce FullCalendar Integration</title>
  <!-- Include FullCalendar and its dependencies -->
  <link rel="stylesheet" href="style.css">
  
  <link rel="stylesheet" href="https://unpkg.com/fullcalendar@3.10.0/dist/fullcalendar.min.css" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
  <link rel="stylesheet" href="https://code.getmdl.io/1.3.0/material.indigo-pink.min.css">


  <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.32/moment-timezone-with-data.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.9/index.global.min.js"></script>

  <script src="script.js"></script> 
</head>
<body> 
  <div id="side-nav" class="spm" style="display:none;">
   
    <a href="#" class="closebtn" onclick="close_window();return false;">
    <span class="material-symbols-outlined">
    close
    </span></a>
    <div class="type-block">
      <div class="lozenge">
          <span id="typedial" class="typedial event"></span>
          <span id="type-text">Event</span>
      </div>
    </div>
        <h1></h1>
       
        <!--<div class="attendees">
          <span><b>Attending:</b></span>
        </div>-->
       

       <!-- <div class="description-area">
          <p id="desc-text"></p>
        </div>-->
   </div>
  <div id="calendar"></div>




</body>
</html>


```


script.js
```

document.addEventListener('DOMContentLoaded', function () {
  // Fetch Salesforce opportunities and populate the calendar
  fetch('/api/opportunities')
  .then(response => {
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
        
    }
    return response.json();
})
.then(data => {

    // Ensure data is an array of opportunities
    if (!data || !Array.isArray(data.opportunities)) {
        throw new Error('Expected an array of opportunities, but received:', data);
    }
        

      // Format Salesforce data to FullCalendar events format
        const timeslots = data.timeslots.map(timeslot => ({
          title: timeslot.Name,
          allDay: false,
          start:  moment.utc(timeslot.goldenapp__Start__c).tz('Australia/Sydney').format(),
          end: moment.utc(timeslot.goldenapp__End__c).tz('Australia/Sydney').format(),
          type: 'volunteer'
          
        }));  

        // Format Salesforce data to FullCalendar events format
          const events = data.opportunities.map(opportunity => ({
            title: opportunity.Name,
            allDay: false,
            start:  moment.utc(opportunity.Event_Start_Date_Time__c).tz('Australia/Sydney').format(),
            end: moment.utc(opportunity.Event_End_Date_Time__c).tz('Australia/Sydney').format(),
            type: opportunity.Type

          }));

    
          const allMappedEvents = events.concat(timeslots);

          
            var calendarEl = document.getElementById('calendar');
            var calendar = new FullCalendar.Calendar(calendarEl, {
              timeZone: 'Australia/Sydney',
              headerToolbar: {
                 left: 'prev,next today',
                 center: 'title',
                 right: 'dayGridWeek,timeGridDay'
                },
              navLinks: true,
              initialView: 'timeGridDay',
              nowIndicator: true,
              events: allMappedEvents ,
                slotMinTime: '06:00:00',   // Earliest time to start displaying slots
                scrollTime: '07:00:00',    // Determines the initial scroll position
              eventClick: function(info) {
                document.getElementById("side-nav").style.display = "block";
                const h1 = document.querySelector("h1")
                h1.innerText = info.event.title;
  
      
 
  
                var eventspec = document.getElementById("typedial");
                eventspec.classList.remove('Corporate-Event', 'School-Program', 'Cooking-with-Family', 'Birthday-Party', 'OBK-Catering', 'volunteer');

                // Add the new class based on the event type
                const eventTypeClass = info.event.extendedProps.type.replace(/\s+/g, '-');
                eventspec.classList.add(eventTypeClass);

                // Update the type text in the lozenge
                const typeText = document.getElementById("type-text");
                typeText.innerText = eventTypeClass;
             
              },
              eventClassNames: function (arg) {
                if (arg.event.extendedProps && arg.event.extendedProps.type) {
                  return 'event-type-' + arg.event.extendedProps.type.replace(/\s+/g, '-');
                } else {
                  console.error('Extended properties or type not defined for the event:', arg.event);
                  return ''; // Return an empty string or handle it as needed
                }
              }
              
            });
            calendar.render();
       

        
      });
});

function close_window(){
  document.getElementById("side-nav").style.display = "none";
```


style.css
```css

/*  Sidenav */
.spm {
    width:18vw;
    background:#fff;
    height:100%;
    position:fixed;
    z-index:10000;
    right:0;
    padding:16px;
    box-shadow: -1px 1px 2px 1px #f2f2f2;
}
.spm h1 {font-size:1.6em;}
#event-time {margin-top:21px;}
.float-key { position: fixed;
    z-index: 1;
    bottom: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    background: #fff;
    padding: 9px 18px!important;
    gap: 16px;
    border-radius: 6px;
    box-shadow: 1px 1px 1px 1px #e9e9e9;}

#typedial, .typedial { 
    border-radius:50%;
    width:16px;
    height:16px;
    display:inline-block;
}
.eventype {
    display: flex;
    gap: 4px;
    align-items: center;
}

.lozenge { width:100%; padding: 4px 4px 4px 8px; border-radius:7px; display:flex; gap:8px; align-items: center; justify-content: left; margin:20px 0; color:#44546F;}
.typedial.event {    background-color:#18A0FB; }
.typedial.charities {     background-color:#7A66FF;}
.typedial.catering {    background-color:#1BC47D; }

.time-block,.attendees {margin-bottom:20px;}

/*  Overrides */
#calendar h2 {
    font-size: 1.4em!important;
}
.fc-content {    
    min-height: 36px;
    padding: 8px 8px;}

.fc-title {color: #222222!important; font-size:1.1em; font-weight:600;}
.fc-v-event .fc-event-title { font-size: 1.2em; }
.fc .fc-toolbar.fc-header-toolbar {padding:8px 26px;}
.fc-toolbar, .fc-today-button, #type-text { text-transform: capitalize!important; }
.fc .fc-timegrid-col.fc-day-today, .fc .fc-daygrid-day.fc-day-today, .fc .fc-cell-shaded, .fc .fc-day-disabled {
    background-color: #E9F1FF!important;
}
.fc-event-time {font-size:1em;}
.fc-timegrid-event .fc-event-main {padding:2px 16px!important;}
.fc-button-primary {height:36px!important; text-transform: capitalize!important;}

.event-type-Corporate-Event  .fc-event-main, .event-type-School-Program .fc-event-main, 
.event-type-Cooking-with-Family .fc-event-main,  .event-type-Birthday-Party .fc-event-main, .event-type-OBK-Catering .fc-event-main, .event-type-volunteer .fc-event-main, .event-type-OOSH---Vacation-Care .fc-event-main {color:#172B4D!important;}

.event-type-Corporate-Event { background-color:#DCFFF1!important; border:0!important; border-left:3px solid #4BCE97!important;  color:#172B4D!important;}
.event-type-School-Program, .event-type-OOSH---Vacation-Care { background-color:#DCFFF1!important; border:0!important; border-left:3px solid #4BCE97!important; color:#172B4D!important;}
.event-type-Cooking-with-Family, .event-type-Birthday-Party {background-color:#FFECF8!important; border:0!important; border-left:3px solid #E774BB!important; color:#172B4D!important;}
.event-type-OBK-Catering {background-color:#DFD8FD!important; border:0!important; border-left:3px solid #9F8FEF!important; color:#172B4D!important; }
.event-type-volunteer {background-color:#FFF7D6!important; border:0!important; border-left:3px solid #F5CD47!important; color:#172B4D!important;  }


.event-type-School-Program .fc-daygrid-event-dot, .event-type-Corporate-Event .fc-daygrid-event-dot, .event-type-OOSH---Vacation-Care .fc-daygrid-event-dot {border-color:#4BCE97!important;}
.event-type-Cooking-with-Family .fc-daygrid-event-dot, .event-type-Birthday-Party .fc-daygrid-event-dot {border-color:#F5CD47!important;}
.event-type-OBK-Catering .fc-daygrid-event-dot {border-color:#9F8FEF!important;}
.event-type-volunteer .fc-daygrid-event-dot  {border-color:#F5CD47!important;}

.Corporate-Event, .School-Program,.OOSH---Vacation-Care { background-color:#4BCE97!important;}
.Cooking-with-Family, .Birthday-Party { background-color:#E774BB!important;}
.OBK-Catering{background-color:#9F8FEF!important;}
.volunteer { background-color:#F5CD47!important; }

```

