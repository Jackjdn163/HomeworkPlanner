let schedule = loadJSON("schedule", null);

function populateSelect(id, options){
  const select = document.getElementById(id);

  if(!select) return;

  select.innerHTML = "";

  options.forEach(option => {
    select.innerHTML += `<option value="${option}">${option}</option>`;
  });
}

function populateAllDropdowns(){
  populateSelect("class", classes);

  [
    "a1","a2","a3","a4",
    "b1","b2","b3","b4"
  ].forEach(id => populateSelect(id, classes));
}

function setDefaultDates(){
  const today = formatDateLocal(new Date());

  const assigned = document.getElementById("assigned");
  const due = document.getElementById("due");
  const busyDate = document.getElementById("busyDate");

  if(assigned) assigned.value = today;
  if(due) due.value = today;
  if(busyDate) busyDate.value = today;
}

function renderTodayText(){
  const todayText = document.getElementById("todayText");

  if(!todayText) return;

  const now = new Date();
  const ab = getABDay(now);

  todayText.innerHTML = `
    <div>${now.toLocaleDateString("en-US",{
      weekday:"long",
      month:"long",
      day:"numeric"
    })}</div>
    <div style="font-size:0.82rem; opacity:0.72; margin-top:3px;">
      ${ab} Day
    </div>
  `;
}

function showSetupIfNeeded(){
  const setup = document.getElementById("setup");

  if(!setup) return;

  if(!schedule){
    setup.classList.remove("hidden");
  }
}

function saveSchedule(){
  schedule = {
    A:[
      document.getElementById("a1").value,
      document.getElementById("a2").value,
      document.getElementById("a3").value,
      document.getElementById("a4").value
    ],

    B:[
      document.getElementById("b1").value,
      document.getElementById("b2").value,
      document.getElementById("b3").value,
      document.getElementById("b4").value
    ]
  };

  saveScheduleData();

  document.getElementById("setup").classList.add("hidden");

  renderAll();
}

function resetScheduleSetup(){
  localStorage.removeItem("schedule");
  schedule = null;

  const setup = document.getElementById("setup");

  if(setup){
    setup.classList.remove("hidden");
  }
}

function initializeApp(){
  populateAllDropdowns();
  setDefaultDates();
  renderTodayText();
  updateDateFields();
  showSetupIfNeeded();

  if(!schedule){
    schedule = {
      A:["Math","English","History","Science"],
      B:["Theatre","Spanish","Elective","Health/Fitness"]
    };
  }

  initializeAI();
  renderAll();

  setInterval(() => {
    renderTodayText();
    renderWeek();
  }, 60000);
}

initializeApp();
