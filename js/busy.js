let busy = JSON.parse(
  localStorage.getItem("busy")
) || [];

function addBusy(){

  busy.push({

    id:Date.now(),

    title:busyTitle.value,

    repeat:repeat.value,

    date:busyDate.value,

    start:busyStart.value,

    end:busyEnd.value

  });

  saveBusy();
  renderWeek();
}
