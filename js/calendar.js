function renderWeek(){

  renderAIInsights();
  renderMajorAssignment();

  const grid =
  document.getElementById("weekGrid");

  grid.innerHTML = "";

  let monday =
  new Date();

  while(monday.getDay() !== 1){

    monday.setDate(
      monday.getDate()-1
    );

  }

  for(let i=0;i<5;i++){

    const date =
    new Date(monday);

    date.setDate(
      monday.getDate()+i
    );

    const ab =
    getABDay(date);

    const day =
    document.createElement("div");

    day.className = "day";

    if(
      date.toDateString() ===
      new Date().toDateString()
    ){

      day.classList.add(
        "today-day"
      );

    }

    day.innerHTML = `

      <div class="day-header">

        <div class="day-name">
          ${date.toLocaleDateString(
            "en-US",
            {weekday:"long"}
          )}
        </div>

        <div class="ab-day">
          ${ab} Day
        </div>

      </div>

      <div class="timeline"></div>

    `;

    grid.appendChild(day);

    const timeline =
    day.querySelector(".timeline");

    /* HOURS */

    for(let h=8; h<=24; h++){

      const row =
      document.createElement("div");

      row.className = "hour-row";

      const label =
      h===24
      ? "12 AM"
      : h>12
      ? `${h-12} PM`
      : `${h} AM`;

      row.innerHTML = `

        <div class="hour-label">
          ${label}
        </div>

        <div class="hour-line"></div>

      `;

      timeline.appendChild(row);

    }

    /* CLASSES */

    (schedule?.[ab] || [])
    .forEach((cls,index)=>{

      const t =
      classTimes[index];

      const block =
      document.createElement("div");

      block.className =
      "event class-event";

      block.style.top =
      `${hourToPixels(t.start)}px`;

      block.style.height =
      `${(t.end-t.start)*80}px`;

      block.innerHTML = `

        <div class="event-title">
          ${cls}
        </div>

        <div class="event-sub">
          ${t.label}
        </div>

      `;

      timeline.appendChild(block);

    });

    /* FLEX LUNCH */

    const lunch =
    document.createElement("div");

    lunch.className =
    "event homework-event";

    lunch.style.top =
    `${hourToPixels(10.83)}px`;

    lunch.style.height =
    `${(12-10.83)*80}px`;

    lunch.innerHTML = `

      <div class="event-title">
        Flex Time / Lunch
      </div>

      <div class="event-sub">
        Homework Opportunity
      </div>

    `;

    timeline.appendChild(lunch);

    /* BUS */

    const bus =
    document.createElement("div");

    bus.className =
    "event homework-event";

    bus.style.top =
    `${hourToPixels(14.83)}px`;

    bus.style.height =
    `${(16-14.83)*80}px`;

    bus.innerHTML = `

      <div class="event-title">
        Bus Ride / Homework
      </div>

      <div class="event-sub">
        Study Opportunity
      </div>

    `;

    timeline.appendChild(bus);

    /* BUSY EVENTS */

    busy.forEach((b,index)=>{

      const currentDate =
      date.toISOString().split("T")[0];

      let shouldShow = false;

      if(b.repeat === "One Time"){

        shouldShow =
        b.date === currentDate;

      }

      else if(b.repeat === "Daily"){

        shouldShow = true;

      }

      else if(b.repeat === "Weekly"){

        shouldShow =
        new Date(b.date).getDay() ===
        date.getDay();

      }

      else if(b.repeat === "Monthly"){

        shouldShow =
        new Date(b.date).getDate() ===
        date.getDate();

      }

      if(!shouldShow) return;

      const startHour =
      parseInt(
        b.start.split(":")[0]
      ) +
      parseInt(
        b.start.split(":")[1]
      )/60;

      const endHour =
      parseInt(
        b.end.split(":")[0]
      ) +
      parseInt(
        b.end.split(":")[1]
      )/60;

      const block =
      document.createElement("div");

      block.className =
      "event busy-event";

      block.style.top =
      `${hourToPixels(startHour)}px`;

      block.style.height =
      `${(endHour-startHour)*80}px`;

      block.innerHTML = `

        <div class="event-title">
          ${b.title}
        </div>

        <div class="event-sub">
          ${b.start}
          -
          ${b.end}
        </div>

      `;

      timeline.appendChild(block);

    });

    /* ASSIGNMENTS */

    assignments.forEach((a,index)=>{

      if(
        a.due ===
        date
        .toISOString()
        .split("T")[0]
      ){

        const block =
        document.createElement("div");

        let typeClass =
        "homework-event";

        if(
          a.type==="Test" ||
          a.type==="Quiz"
        ){

          typeClass =
          "test-event";

        }

        block.className =
        `event ${typeClass}`;

        const top =
        650 + (index*85);

        block.style.top =
        `${top}px`;

        block.style.height =
        `75px`;

        block.innerHTML = `

          <div class="event-title">
            ${a.title}
          </div>

          <div class="event-sub">
            ${a.className}
            •
            ${a.type}
          </div>

        `;

        timeline.appendChild(block);

      }

    });

  }

}
