let busy = loadJSON("busy", []);

function addBusy(){
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
    alert("Please choose a day.");
    return;
  }

  if(!startInput.value || !endInput.value){
    alert("Please choose a start and end time.");
    return;
  }

  if(startInput.value >= endInput.value){
    alert("End time must be after start time.");
    return;
  }

  busy.push({
    id:Date.now(),
    title:title,
    repeat:repeatInput.value,
    date:dateInput.value,
    start:startInput.value,
    end:endInput.value
  });

  saveBusy();

  titleInput.value = "";
  startInput.value = "";
  endInput.value = "";

  renderAll();
}

function deleteBusy(id){
  busy = busy.filter(item => item.id !== id);
  saveBusy();
  renderAll();
}

function busyAppliesToDate(item, date){
  const currentDateString = formatDateLocal(date);
  const itemDate = parseLocalDate(item.date);

  if(!itemDate) return false;

  if(item.repeat === "One Time"){
    return item.date === currentDateString;
  }

  if(item.repeat === "Daily"){
    return true;
  }

  if(item.repeat === "Weekly"){
    return itemDate.getDay() === date.getDay();
  }

  if(item.repeat === "Monthly"){
    return itemDate.getDate() === date.getDate();
  }

  return false;
}
