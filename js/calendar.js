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

  monday.setDate(
    monday.getDate() + weekOffset * 7
  );

  return monday;
}

function renderWeek(){
  const grid =
    document.getElementById("weekGrid");

  const weekTitle =
    document.getElementById("weekTitle");

  if(!grid) return;

  grid.innerHTML = "";

  const monday =
    getVisibleMonday();

  const friday =
    new Date(monday);

  friday.setDate(
    monday.getDate() + 4
  );

  const smartPlan =
    generateSmartStudyPlan();

  if(weekTitle){
    weekTitle.textContent =
      `${monday.toLocaleDateString("en-US",{month:"short",day:"numeric"})} - ${friday.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
  }

  for(let i = 0; i < 5; i++){
    const date = new Date(monday);

    date.setDate(
      monday.getDate() + i
    );

    renderDayColumn(
      date,
      grid,
      smartPlan
    );
  }
}

function renderDayColumn(date,grid,smartPlan){
  const dateString =
    formatDateLocal(date);

  const ab =
    getABDay(date);

  const day =
    document.createElement("div");

  day.className = "day";

  if(
    date.toDateString() ===
    new Date().toDateString()
  ){
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

  const timeline =
    day.querySelector(".timeline");

  renderHourRows(timeline);
  renderFlexBackgroundBlocks(timeline);
  renderClassBlocks(timeline,ab,dateString);
  renderBusyBlocks(timeline,date);
  renderSmartStudyBlocks(timeline,dateString,smartPlan);
  renderUnmatchedDueAssignments(timeline,dateString,ab);
  renderCurrentTimeLine(timeline,date);
}

function renderHourRows(timeline){
  for(let h = 8; h <= 24; h++){
    const row =
      document.createElement("div");

    row.className = "hour-row";

    row.innerHTML = `
      <div class="hour-label">
        ${formatHourLabel(h)}
      </div>

      <div class="hour-line"></div>
    `;

    timeline.appendChild(row);
  }
}

function renderFlexBackgroundBlocks(timeline){
  const lunch =
    createEventBlock({
      title:"Flex Time / Lunch",
      subtitle:"10:50 - 12:00 · Available for homework",
      className:"flex-event",
      start:10 + 50/60,
      end:12
    });

  const bus =
    createEventBlock({
      title:"Bus Ride / Homework",
      subtitle:"2:50 - 4:00 · Available for study",
      className:"flex-event",
      start:14 + 50/60,
      end:16
    });

  const afterSchool =
    createEventBlock({
      title:"After School",
      subtitle:"4:00 - 10:00 · Main work window",
      className:"flex-event",
      start:16,
      end:22
    });

  timeline.appendChild(lunch);
  timeline.appendChild(bus);
  timeline.appendChild(afterSchool);
}

function renderClassBlocks(timeline,ab,dateString){
  const classesToday =
    schedule?.[ab] || [];

  classesToday.forEach((className,index) => {
    const time =
      classTimes[index];

    if(!time) return;

    const dueForThisClass =
      assignments.filter(item =>
        item.due === dateString &&
        item.className === className
      );

    const dueHTML =
      dueForThisClass.map(item => `
        <div class="due-inside-class ${
          item.type === "Test" ||
          item.type === "Quiz"
          ? "due-test"
          : ""
        }">
          <strong>${item.type}:</strong>
          ${item.title}
        </div>
      `).join("");

    const block =
      createEventBlock({
        title:className,
        subtitle:`Period ${time.period} · ${time.label}`,
        className:"class-event",
        start:time.start,
        end:time.end,
        extraHTML:dueHTML
      });

    timeline.appendChild(block);
  });
}

function renderBusyBlocks(timeline,date){
  busy.forEach(item => {
    if(!busyAppliesToDate(item,date)) return;

    const start =
      timeToDecimal(item.start);

    const end =
      timeToDecimal(item.end);

    if(
      start === null ||
      end === null
    ) return;

    const block =
      createEventBlock({
        title:item.title,
        subtitle:`${item.repeat} · ${item.start} - ${item.end}`,
        className:"busy-event",
        start:start,
        end:end
      });

    timeline.appendChild(block);
  });
}

function renderSmartStudyBlocks(timeline,dateString,smartPlan){
  const sessions =
    smartPlan[dateString] || [];

  sessions.forEach(session => {
    const isBreak =
      session.kind === "break";

    const durationMinutes =
      Math.round(
        (session.end - session.start) * 60
      );

    const timeRange =
      `${decimalHourToTime(session.start)} - ${decimalHourToTime(session.end)}`;

    const block =
      createEventBlock({
        title:
          isBreak
          ? `Break · ${durationMinutes} min`
          : `Work on ${session.title}`,

        subtitle:
          isBreak
          ? timeRange
          : `${timeRange} · ${durationMinutes} min work`,

        className:
          isBreak
          ? "break-event"
          : "study-event",

        start:session.start,
        end:session.end,

        extraHTML:
          isBreak
          ? ""
          : `<div class="event-chip">${session.className} · due ${session.due}</div>`
      });

    timeline.appendChild(block);
  });
}

function renderUnmatchedDueAssignments(timeline,dateString,ab){
  const classesToday =
    schedule?.[ab] || [];

  const unmatched =
    assignments.filter(item =>
      item.due === dateString &&
      !classesToday.includes(item.className)
    );

  unmatched.forEach((item,index) => {
    const start =
      16.25 + index * 0.85;

    const end =
      start + 0.65;

    let eventClass =
      "homework-event";

    if(
      item.type === "Test" ||
      item.type === "Quiz"
    ){
      eventClass = "test-event";
    }

    if(item.type === "Studying"){
      eventClass = "study-event";
    }

    const block =
      createEventBlock({
        title:`Due: ${item.title}`,
        subtitle:`${item.className} · ${item.type}`,
        className:eventClass,
        start:start,
        end:end
      });

    timeline.appendChild(block);
  });
}

function renderCurrentTimeLine(timeline,date){
  const now =
    new Date();

  if(
    date.toDateString() !==
    now.toDateString()
  ) return;

  const currentHour =
    now.getHours() + now.getMinutes()/60;

  if(
    currentHour < 8 ||
    currentHour > 24
  ) return;

  const line =
    document.createElement("div");

  line.className =
    "current-time-line";

  line.style.top =
    `${hourToPixels(currentHour)}px`;

  timeline.appendChild(line);
}

/*
  Important:
  Breaks are now allowed to be visually short.
  This prevents them from covering the next work block.
*/

function createEventBlock({
  title,
  subtitle,
  className,
  start,
  end,
  extraHTML = ""
}){
  const block =
    document.createElement("div");

  const isBreak =
    className === "break-event";

  const visualGap =
    isBreak ? -3 : 4;

  const rawHeight =
    (end - start) * 72;

  const minHeight =
    isBreak ? 16 : 36;

  block.className =
    `event ${className}`;

  block.style.top =
    `${hourToPixels(start) + visualGap}px`;

  block.style.height =
    `${Math.max(minHeight,rawHeight - 2)}px`;

  block.innerHTML = `
    <div class="event-title">
      ${title}
    </div>

    <div class="event-sub">
      ${subtitle}
    </div>

    ${extraHTML}
  `;

  return block;
}
  return block;
}
