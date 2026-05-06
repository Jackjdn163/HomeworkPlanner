const classes = [
  "Math",
  "English",
  "History",
  "Theatre",
  "Spanish",
  "Health/Fitness",
  "Elective",
  "Science",
  "Studying",
  "Other"
];

const classTimes = [
  {
    period: "1-2",
    start: 8,
    end: 9 + 23 / 60,
    label: "8:00 - 9:23"
  },
  {
    period: "3-4",
    start: 9 + 23 / 60,
    end: 10 + 50 / 60,
    label: "9:23 - 10:50"
  },
  {
    period: "7-8",
    start: 12,
    end: 13 + 23 / 60,
    label: "12:00 - 1:23"
  },
  {
    period: "9-10",
    start: 13 + 23 / 60,
    end: 14 + 50 / 60,
    label: "1:23 - 2:50"
  }
];

/*
  Today was set as an A Day based on your original request.
  This anchor date is May 6, 2026.
  If your real school calendar gets off later, change this date.
*/
const anchorADay = new Date(2026, 4, 6);
anchorADay.setHours(0, 0, 0, 0);

function parseLocalDate(dateString){
  if(!dateString) return null;

  const parts = dateString.split("-").map(Number);

  return new Date(
    parts[0],
    parts[1] - 1,
    parts[2]
  );
}

function formatDateLocal(date){
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonday(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay();

  const diff =
    day === 0
      ? -6
      : 1 - day;

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

  const direction =
    end >= start
      ? 1
      : -1;

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

function getABDay(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if(isWeekend(d)){
    return "Weekend";
  }

  const schoolDayDifference =
    countSchoolDaysBetween(anchorADay, d);

  return Math.abs(schoolDayDifference) % 2 === 0
    ? "A"
    : "B";
}

function hourToPixels(hour){
  return (hour - 8) * 72;
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

function timeToDecimal(timeString){
  if(!timeString) return null;

  const parts = timeString.split(":").map(Number);

  const hours = parts[0];
  const minutes = parts[1];

  return hours + minutes / 60;
}
