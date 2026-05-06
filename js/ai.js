/* =========================
   STUDYFLOW AI ENGINE
========================= */

function getDaysUntil(dateString){

  const now = new Date();

  const target =
  new Date(dateString);

  const diff =
  target - now;

  return Math.ceil(
    diff / (1000*60*60*24)
  );

}

/* =========================
   PRIORITY SCORE
========================= */

function calculatePriority(a){

  let score = 0;

  const days =
  getDaysUntil(a.due);

  /* DUE DATE */

  if(days <= 1){

    score += 100;

  }

  else if(days <= 3){

    score += 60;

  }

  else if(days <= 7){

    score += 30;

  }

  /* HOURS */

  score +=
  Number(a.hours || 1) * 8;

  /* TYPE */

  if(a.type === "Test"){

    score += 80;

  }

  if(a.type === "Quiz"){

    score += 50;

  }

  if(a.type === "Essay"){

    score += 70;

  }

  if(a.type === "Project"){

    score += 90;

  }

  return score;

}

/* =========================
   SORT TASKS
========================= */

function getPriorityAssignments(){

  return assignments
  .map(a=>({

    ...a,

    priority:
    calculatePriority(a)

  }))

  .sort((a,b)=>

    b.priority -
    a.priority

  );

}

/* =========================
   FREE TIME
========================= */

function calculateFreeHoursToday(){

  const now =
  new Date();

  const currentHour =
  now.getHours() +
  (now.getMinutes()/60);

  let remaining =
  24 - currentHour;

  /* sleep estimate */

  remaining -= 8;

  /* school estimate */

  if(currentHour < 16){

    remaining -=
    (16-currentHour);

  }

  /* busy events */

  busy.forEach(b=>{

    const today =
    new Date()
    .toISOString()
    .split("T")[0];

    let applies = false;

    if(b.repeat === "Daily"){

      applies = true;

    }

    else if(
      b.repeat === "One Time" &&
      b.date === today
    ){

      applies = true;

    }

    if(applies){

      const start =
      parseInt(
        b.start.split(":")[0]
      );

      const end =
      parseInt(
        b.end.split(":")[0]
      );

      remaining -=
      (end-start);

    }

  });

  return Math.max(
    0,
    remaining.toFixed(1)
  );

}

/* =========================
   TOTAL WORKLOAD
========================= */

function calculateTotalWorkload(){

  let total = 0;

  assignments.forEach(a=>{

    total +=
    Number(a.hours || 1);

  });

  return total;

}

/* =========================
   BURNOUT DETECTION
========================= */

function getStressLevel(){

  const workload =
  calculateTotalWorkload();

  if(workload >= 20){

    return {
      level:"Extreme",
      color:"#ef4444"
    };

  }

  if(workload >= 10){

    return {
      level:"High",
      color:"#f59e0b"
    };

  }

  if(workload >= 5){

    return {
      level:"Moderate",
      color:"#eab308"
    };

  }

  return {
    level:"Low",
    color:"#10b981"
  };

}

/* =========================
   AI RECOMMENDATION
========================= */

function getBestTask(){

  const sorted =
  getPriorityAssignments();

  return sorted[0];

}

/* =========================
   CAN FINISH TONIGHT
========================= */

function canFinishTonight(){

  const free =
  calculateFreeHoursToday();

  const workload =
  calculateTotalWorkload();

  return workload <= free;

}

/* =========================
   AI PANEL
========================= */

function renderAIInsights(){

  let panel =
  document.getElementById(
    "aiInsights"
  );

  if(!panel){

    panel =
    document.createElement("div");

    panel.id = "aiInsights";

    panel.className = "card";

    document
    .querySelector(".sidebar")
    .prepend(panel);

  }

  const best =
  getBestTask();

  const stress =
  getStressLevel();

  const finish =
  canFinishTonight();

  panel.innerHTML = `

    <div class="section-title">
      AI Planner
    </div>

    <div style="
      margin-bottom:18px;
    ">

      <div style="
        font-size:0.8rem;
        opacity:0.7;
        margin-bottom:5px;
      ">
        RECOMMENDED TASK
      </div>

      <div style="
        font-size:1.2rem;
        font-weight:800;
      ">
        ${
          best
          ? best.title
          : "Nothing Due"
        }
      </div>

      ${
        best
        ? `
        <div style="
          margin-top:6px;
          opacity:0.75;
        ">
          ${best.className}
          •
          ${best.type}
        </div>
        `
        : ""
      }

    </div>

    <div style="
      margin-bottom:18px;
    ">

      <div style="
        font-size:0.8rem;
        opacity:0.7;
        margin-bottom:5px;
      ">
        TODAY'S FREE TIME
      </div>

      <div style="
        font-size:1.5rem;
        font-weight:800;
      ">
        ${calculateFreeHoursToday()}h
      </div>

    </div>

    <div style="
      margin-bottom:18px;
    ">

      <div style="
        font-size:0.8rem;
        opacity:0.7;
        margin-bottom:5px;
      ">
        STRESS LEVEL
      </div>

      <div style="
        font-size:1.2rem;
        font-weight:800;
        color:${stress.color};
      ">
        ${stress.level}
      </div>

    </div>

    <div>

      <div style="
        font-size:0.8rem;
        opacity:0.7;
        margin-bottom:5px;
      ">
        CAN YOU FINISH TONIGHT?
      </div>

      <div style="
        font-size:1.3rem;
        font-weight:800;
        color:
        ${
          finish
          ? "#10b981"
          : "#ef4444"
        };
      ">
        ${
          finish
          ? "YES"
          : "NO"
        }
      </div>

    </div>

  `;

}

/* =========================
   AUTO STUDY BLOCKS
========================= */

function generateStudySuggestions(){

  const sorted =
  getPriorityAssignments();

  return sorted
  .slice(0,3)
  .map(a=>{

    return {

      title:
      `Study ${a.title}`,

      className:
      a.className,

      hours:
      Math.min(
        2,
        Number(a.hours || 1)
      )

    };

  });

}

/* =========================
   AUTO RUN
========================= */

function initializeAI(){

  renderAIInsights();

}
