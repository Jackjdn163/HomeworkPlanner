let schedule = JSON.parse(
  localStorage.getItem("schedule")
) || {

  A:[
    "Math",
    "English",
    "History",
    "Science"
  ],

  B:[
    "Theatre",
    "Spanish",
    "Elective",
    "Health/Fitness"
  ]

};

/* DATE */

document
.getElementById("todayText")
.innerHTML =

new Date()
.toLocaleDateString(
  "en-US",
  {
    weekday:"long",
    month:"long",
    day:"numeric"
  }
);

/* CLASS DROPDOWN */

classes.forEach(c=>{

  document
  .getElementById("class")
  .innerHTML += `

    <option>
      ${c}
    </option>

  `;

});

/* SETUP DROPDOWNS */

[
"a1","a2","a3","a4",
"b1","b2","b3","b4"
]

.forEach(id=>{

  const el =
  document.getElementById(id);

  classes.forEach(c=>{

    el.innerHTML += `

      <option>
        ${c}
      </option>

    `;

  });

});

/* SETUP SCREEN */

if(
  !localStorage.getItem("schedule")
){

  document
  .getElementById("setup")
  .classList.remove("hidden");

}

/* SAVE SCHEDULE */

function saveSchedule(){

  schedule = {

    A:[
      a1.value,
      a2.value,
      a3.value,
      a4.value
    ],

    B:[
      b1.value,
      b2.value,
      b3.value,
      b4.value
    ]

  };

  localStorage.setItem(
    "schedule",
    JSON.stringify(schedule)
  );

  document
  .getElementById("setup")
  .classList.add("hidden");

  renderWeek();

}

/* STARTUP */

renderWeek();

updateDateFields();

initializeAI();
