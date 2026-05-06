function renderWeek(){

  renderMajorAssignment();

  const grid =
  document.getElementById("weekGrid");

  grid.innerHTML = "";

  let monday = new Date();

  while(monday.getDay() !== 1){
    monday.setDate(monday.getDate()-1);
  }

  for(let i=0;i<5;i++){

    const date = new Date(monday);

    date.setDate(
      monday.getDate()+i
    );

    const ab = getABDay(date);

    const day = document.createElement("div");

    day.className = "day";

    day.innerHTML = `
      <div class="day-header">
        <h2>
          ${date.toLocaleDateString(
            "en-US",
            {weekday:"long"}
          )}
        </h2>
        <p>${ab} Day</p>
      </div>
      <div class="timeline"></div>
    `;

    grid.appendChild(day);

    const timeline =
    day.querySelector(".timeline");

    for(let h=8; h<=24; h++){

      const row =
      document.createElement("div");

      row.className = "hour-row";

      row.innerHTML = `
        <div class="hour-label">
          ${h}:00
        </div>
      `;

      timeline.appendChild(row);
    }
  }
}
