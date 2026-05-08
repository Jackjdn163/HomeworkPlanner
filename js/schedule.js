const PERIOD_SLOTS = [
  {
    id: "p1",
    period: "1",
    start: 8,
    end: 9 + 23 / 60,
    label: "8:00 - 9:23"
  },
  {
    id: "p2",
    period: "2",
    start: 9 + 23 / 60,
    end: 11,
    label: "9:23 - 11:00"
  },
  {
    id: "p3",
    period: "3",
    start: 12,
    end: 13 + 23 / 60,
    label: "12:00 - 1:23"
  },
  {
    id: "p4",
    period: "4",
    start: 13 + 23 / 60,
    end: 14 + 50 / 60,
    label: "1:23 - 2:50"
  }
];

const SCHOOL_DAY = {
  start: 8,
  lunchStart: 11,
  lunchEnd: 12,
  busStart: 14 + 50 / 60,
  busEnd: 15.5,
  weekendStudyStart: 10,
  defaultStudyEnd: 22
};

const DEFAULT_ROTATION = {
  A: ["Math", "English", "Science", "History"],
  B: ["Spanish", "Theatre", "Elective", "Health/Fitness"]
};

const DEV_TIME_STORAGE_KEY = "plannerDevTimeSettings";
const DEV_TIME_STEP_MINUTES = 5;
const legacyDevTimeSettings = loadJSON(DEV_TIME_STORAGE_KEY, null);
const hadLegacyDevTimeOverride = Boolean(legacyDevTimeSettings?.enabled);

localStorage.removeItem(DEV_TIME_STORAGE_KEY);

let devTimeSettings = normalizeDevTimeSettings(null);
let scheduleWasSaved = Boolean(loadJSON("schedule", null));
let schedule = normalizeScheduleData(loadJSON("schedule", null)) || getDefaultSchedule();

function getRealNow(){
  return new Date();
}

function clampDevTimeMinutes(minutes, fallbackMinutes){
  const numericMinutes = Number(minutes);

  if(!Number.isFinite(numericMinutes)){
    return fallbackMinutes;
  }

  const roundedMinutes = Math.round(numericMinutes / DEV_TIME_STEP_MINUTES) * DEV_TIME_STEP_MINUTES;

  return Math.min(1435, Math.max(0, roundedMinutes));
}

function getRealMinutesSinceMidnight(){
  const now = getRealNow();
  return now.getHours() * 60 + now.getMinutes();
}

function minutesToTimeValue(minutes){
  const safeMinutes = clampDevTimeMinutes(
    minutes,
    getRealMinutesSinceMidnight()
  );
  const hours = String(Math.floor(safeMinutes / 60)).padStart(2, "0");
  const mins = String(safeMinutes % 60).padStart(2, "0");

  return `${hours}:${mins}`;
}

function timeValueToMinutes(timeValue, fallbackMinutes = null){
  if(!timeValue){
    return fallbackMinutes;
  }

  const parts = String(timeValue).split(":").map(Number);

  if(parts.length !== 2 || parts.some(Number.isNaN)){
    return fallbackMinutes;
  }

  return clampDevTimeMinutes(
    parts[0] * 60 + parts[1],
    fallbackMinutes === null ? getRealMinutesSinceMidnight() : fallbackMinutes
  );
}

function normalizeDevTimeSettings(rawSettings){
  const realNow = getRealNow();

  return {
    enabled: false,
    date: formatDateLocal(realNow),
    timeMinutes: clampDevTimeMinutes(
      realNow.getHours() * 60 + realNow.getMinutes(),
      12 * 60
    )
  };
}

function getDevTimeSettings(){
  return {
    ...devTimeSettings
  };
}

function saveDevTimeSettings(nextSettings = {}){
  devTimeSettings = normalizeDevTimeSettings(nextSettings);
  localStorage.removeItem(DEV_TIME_STORAGE_KEY);
  return getDevTimeSettings();
}

function clearDevTimeSettings(){
  devTimeSettings = normalizeDevTimeSettings(null);
  localStorage.removeItem(DEV_TIME_STORAGE_KEY);
  return getDevTimeSettings();
}

function getNow(){
  return getRealNow();
}

function getTodayDateString(){
  return formatDateLocal(getNow());
}

function getDefaultSchedule(){
  const today = getTodayDateString();

  return {
    anchorADay: today,
    A: PERIOD_SLOTS.map((slot, index) => ({
      slotId: slot.id,
      name: DEFAULT_ROTATION.A[index] || ""
    })),
    B: PERIOD_SLOTS.map((slot, index) => ({
      slotId: slot.id,
      name: DEFAULT_ROTATION.B[index] || ""
    }))
  };
}

function normalizeScheduleData(rawSchedule){
  if(!rawSchedule){
    return null;
  }

  const fallback = getDefaultSchedule();

  return {
    anchorADay: rawSchedule.anchorADay || fallback.anchorADay,
    A: normalizeScheduleDay(rawSchedule.A, fallback.A),
    B: normalizeScheduleDay(rawSchedule.B, fallback.B)
  };
}

function normalizeScheduleDay(dayEntries, fallbackEntries){
  if(!Array.isArray(dayEntries)){
    return fallbackEntries.map(entry => ({ ...entry }));
  }

  return PERIOD_SLOTS.map((slot, index) => {
    const entry = dayEntries[index];

    if(typeof entry === "string"){
      return {
        slotId: slot.id,
        name: entry.trim()
      };
    }

    if(entry && typeof entry === "object"){
      return {
        slotId: slot.id,
        name: String(entry.name || entry.className || "").trim()
      };
    }

    return {
      slotId: slot.id,
      name: fallbackEntries[index]?.name || ""
    };
  });
}

function parseLocalDate(dateString){
  if(!dateString){
    return null;
  }

  const parts = dateString.split("-").map(Number);

  if(parts.length !== 3 || parts.some(Number.isNaN)){
    return null;
  }

  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateLocal(date){
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function escapeHTML(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getMonday(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);
  return d;
}

function isWeekend(date){
  return date.getDay() === 0 || date.getDay() === 6;
}

function countSchoolDaysBetween(startDate, endDate){
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const direction = end >= start ? 1 : -1;
  let current = new Date(start);
  let count = 0;

  while(current.getTime() !== end.getTime()){
    current.setDate(current.getDate() + direction);

    if(!isWeekend(current)){
      count += direction;
    }
  }

  return count;
}

function getAnchorADayDate(){
  const anchor = parseLocalDate(schedule?.anchorADay || "");

  if(anchor){
    anchor.setHours(0, 0, 0, 0);
    return anchor;
  }

  const fallback = getNow();
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

function getABDay(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if(isWeekend(d)){
    return "Weekend";
  }

  const schoolDayDifference = countSchoolDaysBetween(getAnchorADayDate(), d);

  return Math.abs(schoolDayDifference) % 2 === 0 ? "A" : "B";
}

function getClassEntriesForDay(dayKey){
  const dayEntries = schedule?.[dayKey] || getDefaultSchedule()[dayKey];

  return PERIOD_SLOTS.map((slot, index) => ({
    ...slot,
    name: String(dayEntries[index]?.name || "").trim()
  }));
}

function getDisplayClassName(name){
  return name || "Open / Free Block";
}

function getClassOptions(){
  if(typeof getAllKnownClassNames === "function"){
    return getAllKnownClassNames();
  }

  const unique = new Set();

  ["A", "B"].forEach(dayKey => {
    getClassEntriesForDay(dayKey).forEach(entry => {
      if(entry.name){
        unique.add(entry.name);
      }
    });
  });

  const options = [...unique];

  if(!options.includes("General / Other")){
    options.push("General / Other");
  }

  return options;
}

function hourToPixels(hour){
  return (hour - SCHOOL_DAY.start) * 72;
}

function formatHourLabel(hour){
  if(hour === 24){
    return "12 AM";
  }

  if(hour === 12){
    return "12 PM";
  }

  if(hour > 12){
    return `${hour - 12} PM`;
  }

  return `${hour} AM`;
}

function timeToDecimal(timeString, options = {}){
  if(!timeString){
    return null;
  }

  const parts = timeString.split(":").map(Number);

  if(parts.length !== 2 || parts.some(Number.isNaN)){
    return null;
  }

  const decimal = parts[0] + parts[1] / 60;

  if(
    options.midnightAs24 &&
    decimal === 0 &&
    (
      options.referenceStart === undefined ||
      options.referenceStart > 0
    )
  ){
    return 24;
  }

  return decimal;
}

function decimalHourToTime(decimal){
  if(decimal === 24){
    return "12:00 AM";
  }

  const hour = Math.floor(decimal);
  const minutes = Math.round((decimal - hour) * 60);
  const date = new Date();

  date.setHours(hour, minutes, 0, 0);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatHoursValue(hours){
  const safeHours = Number(hours || 0);

  if(safeHours <= 0){
    return "0h";
  }

  if(Number.isInteger(safeHours)){
    return `${safeHours}h`;
  }

  return `${safeHours.toFixed(2).replace(/\.?0+$/, "")}h`;
}

function normalizeAssignmentUrl(urlValue){
  const rawValue = String(urlValue ?? "").trim();

  if(!rawValue){
    return "";
  }

  const normalizedValue = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;

  try{
    const parsedUrl = new URL(normalizedValue);

    if(!["http:", "https:"].includes(parsedUrl.protocol)){
      return "";
    }

    return parsedUrl.toString();
  }catch(error){
    return "";
  }
}

function createAssignmentLinkHTML(urlValue, label, className = "link-button"){
  const safeUrl = normalizeAssignmentUrl(urlValue);

  if(!safeUrl){
    return "";
  }

  return `
    <a
      class="${className}"
      href="${escapeHTML(safeUrl)}"
      target="_blank"
      rel="noreferrer noopener"
    >
      ${escapeHTML(label)}
    </a>
  `;
}

function getAssignmentLinkStatusHTML(
  urlValue,
  {
    linkLabel = "Open Assignment",
    linkClassName = "inline-link-button",
    emptyLabel = "No link attached",
    emptyClassName = "empty-link-pill"
  } = {}
){
  const safeUrl = normalizeAssignmentUrl(urlValue);

  if(safeUrl){
    return createAssignmentLinkHTML(safeUrl, linkLabel, linkClassName);
  }

  return `
    <span class="${emptyClassName}">
      ${escapeHTML(emptyLabel)}
    </span>
  `;
}
