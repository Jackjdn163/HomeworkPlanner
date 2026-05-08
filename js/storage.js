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

  if(typeof markSmartPlanDirty === "function"){
    markSmartPlanDirty();
  }

  if(typeof queueCloudSync === "function"){
    queueCloudSync("assignments");
  }
}

function saveBusy(){
  saveJSON("busy", busy);

  if(typeof markSmartPlanDirty === "function"){
    markSmartPlanDirty();
  }

  if(typeof queueCloudSync === "function"){
    queueCloudSync("busy");
  }
}

function saveScheduleData(){
  saveJSON("schedule", schedule);

  if(typeof markSmartPlanDirty === "function"){
    markSmartPlanDirty();
  }

  if(typeof scheduleWasSaved !== "undefined"){
    scheduleWasSaved = true;
  }

  if(typeof queueCloudSync === "function"){
    queueCloudSync("schedule");
  }
}

function saveWeekOffset(){
  saveJSON("weekOffset", weekOffset);

  if(typeof queueCloudSync === "function"){
    queueCloudSync("week offset");
  }
}
