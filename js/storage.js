function saveAssignments(){
  localStorage.setItem(
    "assignments",
    JSON.stringify(assignments)
  );
}

function saveBusy(){
  localStorage.setItem(
    "busy",
    JSON.stringify(busy)
  );
}

function saveScheduleData(){
  localStorage.setItem(
    "schedule",
    JSON.stringify(schedule)
  );
}
