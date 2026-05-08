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
  const monday = getMonday(getNow());
  monday.setDate(monday.getDate() + weekOffset * 7);
  return monday;
}

function renderWeek(){
  const grid = document.getElementById("weekGrid");
  const weekTitle = document.getElementById("weekTitle");

  if(!grid){
    return;
  }

  grid.innerHTML = "";

  const monday = getVisibleMonday();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const smartPlan = getActiveSmartStudyPlan();

  if(weekTitle){
    weekTitle.textContent = `${monday.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })} - ${sunday.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })}`;
  }

  for(let i = 0; i < 7; i++){
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    renderDayColumn(date, grid, smartPlan);
  }
}

function renderDayColumn(date, grid, smartPlan){
  const dateString = formatDateLocal(date);
  const rotation = getABDay(date);
  const day = document.createElement("div");

  day.className = "day";

  if(date.toDateString() === getNow().toDateString()){
    day.classList.add("today-day");
  }

  day.innerHTML = `
    <div class="day-header">
      <div class="day-name">
        ${date.toLocaleDateString("en-US", { weekday: "long" })}
      </div>
      <div class="day-date">
        ${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
      </div>
      <div class="ab-day">
        ${rotation === "Weekend" ? "Weekend" : `${rotation} Day`}
      </div>
    </div>

    <div class="timeline"></div>
  `;

  grid.appendChild(day);

  const timeline = day.querySelector(".timeline");

  renderHourRows(timeline);
  renderFlexBackgroundBlocks(timeline, date);
  renderFixedSchoolBlocks(timeline, date);
  renderClassBlocks(timeline, rotation, dateString);
  renderBusyBlocks(timeline, date);
  renderWhatIfBusyBlocks(timeline, date);
  renderSmartStudyBlocks(timeline, dateString, smartPlan);
  renderUnmatchedDueAssignments(timeline, dateString, rotation);
  renderCurrentTimeLine(timeline, date);
}

function renderHourRows(timeline){
  for(let hour = SCHOOL_DAY.start; hour <= 24; hour++){
    const row = document.createElement("div");
    row.className = "hour-row";
    row.innerHTML = `
      <div class="hour-label">${formatHourLabel(hour)}</div>
      <div class="hour-line"></div>
    `;

    timeline.appendChild(row);
  }
}

function renderFlexBackgroundBlocks(timeline, date){
  const baseWindows = getBaseStudyWindowsForDate(date);

  baseWindows.forEach(window => {
    const block = createEventBlock({
      title: window.label,
      subtitle: `${decimalHourToTime(window.start)} - ${decimalHourToTime(window.end)}`,
      className: window.visualClassName,
      start: window.start,
      end: window.end
    });

    timeline.appendChild(block);
  });
}

function renderFixedSchoolBlocks(timeline, date){
  if(isWeekend(date)){
    return;
  }

  const busRide = createEventBlock({
    title: "Bus Ride",
    subtitle: `${decimalHourToTime(SCHOOL_DAY.busStart)} - ${decimalHourToTime(SCHOOL_DAY.busEnd)}`,
    className: "bus-event",
    start: SCHOOL_DAY.busStart,
    end: SCHOOL_DAY.busEnd
  });

  timeline.appendChild(busRide);
}

function renderClassBlocks(timeline, rotation, dateString){
  if(rotation === "Weekend"){
    return;
  }

  const classesToday = getClassEntriesForDay(rotation);

  classesToday.forEach(time => {
    const className = getDisplayClassName(time.name);
    const dueForThisClass = time.name
      ? assignments.filter(item =>
        item.due === dateString &&
        item.className === time.name
      )
      : [];

    const dueHTML = dueForThisClass.map(item => `
      <div class="due-inside-class ${item.type === "Test" || item.type === "Quiz" ? "due-test" : ""}">
        <strong>${escapeHTML(item.type)}:</strong>
        ${escapeHTML(item.title)}
      </div>
    `).join("");

    const block = createEventBlock({
      title: className,
      subtitle: `Period ${time.period} · ${time.label}`,
      className: time.name ? "class-event" : "open-event",
      start: time.start,
      end: time.end,
      extraHTML: `
        ${createClassPortalLinkHTML(time.name, "Open Portal", "event-chip event-link-chip")}
        ${dueHTML}
      `,
      styleValue: time.name ? getEventAccentStyle(time.name, "class") : ""
    });

    timeline.appendChild(block);
  });
}

function renderBusyBlocks(timeline, date){
  busy.forEach(item => {
    if(!busyAppliesToDate(item, date)){
      return;
    }

    const busyRange = getBusyRange(item);

    if(!busyRange){
      return;
    }

    const block = createEventBlock({
      title: item.title,
      subtitle: `${item.repeat} · ${item.start} - ${item.end}`,
      className: "busy-event",
      start: busyRange.start,
      end: busyRange.end
    });

    timeline.appendChild(block);
  });
}

function renderWhatIfBusyBlocks(timeline, date){
  getWhatIfBlocksForDate(date).forEach(item => {
    const range = getBusyRange(item);

    if(!range){
      return;
    }

    const block = createEventBlock({
      title: item.title,
      subtitle: `What-if · ${item.start} - ${item.end}`,
      className: "what-if-event",
      start: range.start,
      end: range.end
    });

    timeline.appendChild(block);
  });
}

function renderSmartStudyBlocks(timeline, dateString, smartPlan){
  const sessions = smartPlan.sessionsByDate[dateString] || [];

  sessions.forEach(session => {
    const isBreak = session.kind === "break";
    const durationMinutes = Math.round((session.end - session.start) * 60);
    const timeRange = `${decimalHourToTime(session.start)} - ${decimalHourToTime(session.end)}`;
    const assignment = assignments.find(item => item.id === session.assignmentId);
    const nextSubtask = assignment ? getNextOpenSubtask(assignment) : null;
    const block = createEventBlock({
      title: isBreak ? `Break · ${durationMinutes} min` : `Work on ${session.title}`,
      subtitle: isBreak ? timeRange : `${timeRange} · ${session.priority} priority · ${session.studyMode || "Normal"}`,
      className: isBreak ? "break-event" : "study-event",
      start: session.start,
      end: session.end,
      extraHTML: isBreak ? "" : `
        <div class="event-chip">
          ${durationMinutes} min · ${escapeHTML(session.className)}
        </div>
        ${nextSubtask ? `<div class="event-chip">${escapeHTML(nextSubtask.text)}</div>` : ""}
        ${createAssignmentLinkHTML(session.resourceUrl, "Open Link", "event-chip event-link-chip")}
        ${createClassPortalLinkHTML(session.className, "Portal", "event-chip event-link-chip")}
      `
      ,
      styleValue: isBreak ? "" : getEventAccentStyle(session.className, "study")
    });

    timeline.appendChild(block);
  });
}

function renderUnmatchedDueAssignments(timeline, dateString, rotation){
  const classesToday = rotation === "Weekend"
    ? []
    : getClassEntriesForDay(rotation)
      .map(entry => entry.name)
      .filter(Boolean);

  const unmatched = assignments.filter(item =>
    item.due === dateString &&
    !item.completed &&
    !classesToday.includes(item.className)
  );

  unmatched.forEach((item, index) => {
    const start = 16 + index * 0.8;
    const end = start + 0.6;

    let eventClass = "homework-event";

    if(item.type === "Test" || item.type === "Quiz"){
      eventClass = "test-event";
    }

    if(item.type === "Studying"){
      eventClass = "study-event";
    }

    const block = createEventBlock({
      title: `Due: ${item.title}`,
      subtitle: `${item.className} · ${item.type}`,
      className: eventClass,
      start,
      end,
      styleValue: getEventAccentStyle(item.className, "due")
    });

    timeline.appendChild(block);
  });
}

function renderCurrentTimeLine(timeline, date){
  const now = getNow();

  if(date.toDateString() !== now.toDateString()){
    return;
  }

  const currentHour = now.getHours() + now.getMinutes() / 60;

  if(currentHour < SCHOOL_DAY.start || currentHour > 24){
    return;
  }

  const line = document.createElement("div");
  line.className = "current-time-line";
  line.style.top = `${hourToPixels(currentHour)}px`;

  timeline.appendChild(line);
}

function createEventBlock({
  title,
  subtitle,
  className,
  start,
  end,
  extraHTML = "",
  styleValue = ""
}){
  const block = document.createElement("div");
  const isBreak = className === "break-event";
  const durationMinutes = Math.round((end - start) * 60);
  const isLongBreak = isBreak && durationMinutes > 15;
  const visualGap = isBreak ? 0 : 4;
  const rawHeight = (end - start) * 72;
  const isDense = !isBreak && rawHeight < 72;
  const isTiny = !isBreak && rawHeight < 48;
  const minHeight = isBreak
    ? durationMinutes <= 15
      ? 22
      : 34
    : 36;
  const contentClassName = isBreak
    ? "event-content break-content"
    : "event-content";
  const eventClasses = ["event", className];

  if(isBreak){
    eventClasses.push(isLongBreak ? "long-break" : "compact-break");
  }

  if(isDense){
    eventClasses.push("dense-event");
  }

  if(isTiny){
    eventClasses.push("tiny-event");
  }

  block.className = eventClasses.join(" ");
  block.style.top = `${hourToPixels(start) + visualGap}px`;
  block.style.height = `${Math.max(minHeight, rawHeight)}px`;

  if(styleValue){
    block.style.cssText += styleValue;
  }

  block.innerHTML = `
    <div class="${contentClassName}">
      <div class="event-title">${escapeHTML(title)}</div>
      <div class="event-sub">${escapeHTML(subtitle)}</div>
      ${extraHTML}
    </div>
  `;

  return block;
}
