let weekOffset = loadJSON("weekOffset", 0);

function previousWeek(){
  weekOffset -= 1;
  saveWeekOffset();
  renderAll();
}

function nextWeek(){
  weekOffset += 1;
  saveWeekOffset();
  renderAll();
}

function goToCurrentWeek(){
  weekOffset = 0;
  saveWeekOffset();
  renderAll();
}

function getVisibleMonday(){
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  return monday;
}

function renderWeek(){
  const grid = document.getElementById("weekGrid");
  const weekTitle = document.getElementById("weekTitle");

  if(!grid) return;

  grid.innerHTML = "";

  const monday = getVisibleMonday();
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  if(weekTitle){
    weekTitle.textContent =
      `${monday.toLocaleDateString("en-US",{month:"short",day:"numeric"})} - ${friday.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
  }

  for(let i = 0; i < 5; i++){
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);

    renderDayColumn(date, grid);
  }
}

function renderDayColumn(date, grid){
  const dateString = formatDateLocal(date);
  const ab = getABDay(date);

  const day = document.createElement("div");
  day.className = "day";

  if(date.toDateString() === new Date().toDateString()){
    day.classList.add("today-day");
  }

  day.innerHTML = `
    <div class="day-header">
      <div class="day-name">
        ${date.toLocaleDateString("en-US",{weekday:"long"})}
      </div>

      <div class="day-date">
        ${date.toLocaleDateString("en-US",{month:"long",day:"numeric"})}
      </div>

      <div class="ab-day">
        ${ab} Day
      </div>
    </div>

    <div class="timeline"></div>
  `;

  grid.appendChild(day);

  const timeline = day.querySelector(".timeline");

  renderHourRows(timeline);
  renderClassBlocks(timeline, ab);
  renderFlexBlocks(timeline);
  renderBusyBlocks(timeline, date);
  renderAssignmentBlocks(timeline, dateString);
  renderCurrentTimeLine(timeline, date);
}

function renderHourRows(timeline){
  for(let h = 8; h <= 24; h++){
    const row = document.createElement("div");
    row.className = "hour-row";

    row.innerHTML = `
      <div class="hour-label">${formatHourLabel(h)}</div>
      <div class="hour-line"></div>
    `;

    timeline.appendChild(row);
  }
}

function renderClassBlocks(timeline, ab){
  const classesToday = schedule?.[ab] || [];

  classesToday.forEach((className, index) => {
    const time = classTimes[index];

    if(!time) return;

    const block = createEventBlock({
      title:className,
      subtitle:`Period ${time.period} · ${time.label}`,
      className:"class-event",
      start:time.start,
      end:time.end
    });

    timeline.appendChild(block);
  });
}

function renderFlexBlocks(timeline){
  const lunch = createEventBlock({
    title:"Flex Time / Lunch",
    subtitle:"10:50 - 12:00 · Homework Opportunity",
    className:"homework-event",
    start:10 + 50/60,
    end:12
  });

  const bus = createEventBlock({
    title:"Bus Ride / Homework",
    subtitle:"2:50 - 4:00 · Study Opportunity",
    className:"homework-event",
    start:14 + 50/60,
    end:16
  });

  timeline.appendChild(lunch);
  timeline.appendChild(bus);
}

function renderBusyBlocks(timeline, date){
  busy.forEach(item => {
    if(!busyAppliesToDate(item, date)) return;

    const start = timeToDecimal(item.start);
    const end = timeToDecimal(item.end);

    if(start === null || end === null) return;

    const block = createEventBlock({
      title:item.title,
      subtitle:`${item.repeat} · ${item.start} - ${item.end}`,
      className:"busy-event",
      start:start,
      end:end
    });

    timeline.appendChild(block);
  });
}

function renderAssignmentBlocks(timeline, dateString){
  const dueToday = assignments.filter(item => item.due === dateString);

  dueToday.forEach((item, index) => {
    const start = 16.2 + index * 1.05;
    const end = start + 0.9;

    let eventClass = "homework-event";

    if(item.type === "Test" || item.type === "Quiz"){
      eventClass = "test-event";
    }

    if(item.type === "Studying"){
      eventClass = "study-event";
    }

    const block = createEventBlock({
      title:item.completed ? `✓ ${item.title}` : item.title,
      subtitle:`${item.className} · ${item.type} · Due`,
      className:eventClass,
      start:start,
      end:end
    });

    if(item.completed){
      block.style.opacity = "0.48";
    }

    timeline.appendChild(block);
  });
}

function renderCurrentTimeLine(timeline, date){
  const now = new Date();

  if(date.toDateString() !== now.toDateString()) return;

  const currentHour = now.getHours() + now.getMinutes()/60;

  if(currentHour < 8 || currentHour > 24) return;

  const line = document.createElement("div");
  line.className = "current-time-line";
  line.style.top = `${hourToPixels(currentHour)}px`;

  timeline.appendChild(line);
}

function createEventBlock({title, subtitle, className, start, end}){
  const block = document.createElement("div");

  block.className = `event ${className}`;
  block.style.top = `${hourToPixels(start)}px`;
  block.style.height = `${Math.max(38,(end - start) * 80)}px`;

  block.innerHTML = `
    <div class="event-title">${title}</div>
    <div class="event-sub">${subtitle}</div>
  `;

  return block;
}
