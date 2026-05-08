let busy = normalizeBusyItems(loadJSON("busy", []));

function normalizeBusyItems(items){
  if(!Array.isArray(items)){
    return [];
  }

  return items.map((item, index) => ({
    id: Number(item?.id) || Date.now() + index,
    title: String(item?.title || "").trim(),
    repeat: String(item?.repeat || "One Time"),
    date: item?.date || getTodayDateString(),
    start: item?.start || "15:30",
    end: item?.end || "16:30"
  }));
}

function addBusy(){
  if(isReadOnlySharedView()){
    return;
  }

  const titleInput = document.getElementById("busyTitle");
  const repeatInput = document.getElementById("repeat");
  const dateInput = document.getElementById("busyDate");
  const startInput = document.getElementById("busyStart");
  const endInput = document.getElementById("busyEnd");

  const title = titleInput.value.trim();

  if(!title){
    alert("Please enter a busy time title.");
    return;
  }

  if(!dateInput.value){
    alert("Please choose an anchor day.");
    return;
  }

  if(!startInput.value || !endInput.value){
    alert("Please choose a start and end time.");
    return;
  }

  const busyRange = getBusyRange({
    start: startInput.value,
    end: endInput.value
  });

  if(!busyRange){
    alert("End time must be after start time.");
    return;
  }

  busy.push({
    id: Date.now(),
    title,
    repeat: repeatInput.value,
    date: dateInput.value,
    start: startInput.value,
    end: endInput.value
  });

  saveBusy();

  titleInput.value = "";
  startInput.value = "";
  endInput.value = "";

  if(typeof closeQuickAdd === "function"){
    closeQuickAdd();
  }

  renderAll();
}

function deleteBusy(id){
  if(isReadOnlySharedView()){
    return;
  }

  busy = busy.filter(item => item.id !== id);
  saveBusy();
  renderAll();
}

function getBusyRange(item){
  const start = timeToDecimal(item.start);
  const end = timeToDecimal(item.end, {
    midnightAs24: true,
    referenceStart: start
  });

  if(start === null || end === null || end <= start){
    return null;
  }

  return {
    start,
    end
  };
}

function busyAppliesToDate(item, date){
  const currentDateString = formatDateLocal(date);
  const itemDate = parseLocalDate(item.date);

  if(!itemDate){
    return false;
  }

  if(item.repeat === "One Time"){
    return item.date === currentDateString;
  }

  if(item.repeat === "Daily"){
    return true;
  }

  if(item.repeat === "Weekdays"){
    return !isWeekend(date);
  }

  if(item.repeat === "Weekly"){
    return itemDate.getDay() === date.getDay();
  }

  if(item.repeat === "Monthly"){
    return itemDate.getDate() === date.getDate();
  }

  return false;
}
