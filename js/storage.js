function loadJSON(key, fallback){
  try{
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  }catch(error){
    console.warn("Could not load", key, error);
    return fallback;
  }
}

function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function saveAssignments(){
  saveJSON("assignments", assignments);
}

function saveBusy(){
  saveJSON("busy", busy);
}

function saveScheduleData(){
  saveJSON("schedule", schedule);
}

function saveWeekOffset(){
  saveJSON("weekOffset", weekOffset);
}
