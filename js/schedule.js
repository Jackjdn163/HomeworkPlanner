const classes = [
  "Math",
  "English",
  "History",
  "Theatre",
  "Spanish",
  "Health/Fitness",
  "Elective",
  "Science",
  "Study Hall",
  "Other"
];

const classTimes = [
  {
    start:8,
    end:9.38,
    label:"8:00 - 9:23"
  },
  {
    start:9.38,
    end:10.83,
    label:"9:23 - 10:50"
  },
  {
    start:12,
    end:13.38,
    label:"12:00 - 1:23"
  },
  {
    start:13.38,
    end:14.83,
    label:"1:23 - 2:50"
  }
];

function getSchoolDayIndex(date){

  let start = new Date();
  start.setHours(0,0,0,0);

  let current = new Date(start);
  let count = 0;

  while(current < date){

    current.setDate(current.getDate()+1);

    if(current.getDay() !== 0 && current.getDay() !== 6){
      count++;
    }
  }

  return count;
}

function getABDay(date){
  return getSchoolDayIndex(date)%2===0
  ? "A"
  : "B";
}
