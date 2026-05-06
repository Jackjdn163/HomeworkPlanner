function getDaysUntil(dateString){
  const now = new Date();
  now.setHours(0,0,0,0);

  const target = parseLocalDate(dateString);

  if(!target) return 999;

  target.setHours(0,0,0,0);

  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function calculatePriority(assignment){
  if(assignment.completed) return -999;

  let score = 0;

  const days = getDaysUntil(assignment.due);

  if(days <= 0){
    score += 140;
  }else if(days <= 1){
    score += 110;
  }else if(days <= 3){
    score += 75;
  }else if(days <= 7){
    score += 40;
  }else{
    score += 15;
  }

  score += Number(assignment.hours || 1) * 9;

  if(assignment.type === "Test") score += 90;
  if(assignment.type === "Project") score += 85;
  if(assignment.type === "Essay") score += 70;
  if(assignment.type === "Quiz") score += 55;
  if(assignment.type === "Homework") score += 25;
  if(assignment.type === "Studying") score += 20;

  return score;
}

function getPriorityAssignments(){
  return assignments
    .map(item => ({
      ...item,
      priority:calculatePriority(item)
    }))
    .filter(item => !item.completed)
    .sort((a,b) => b.priority - a.priority);
}

function getBestTask(){
  return getPriorityAssignments()[0] || null;
}

function calculateTotalWorkload(){
  return assignments
    .filter(item => !item.completed)
    .reduce((sum,item) => sum + Number(item.hours || 1), 0);
}

function calculateFreeHoursToday(){
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes()/60;

  let available = 0;

  if(currentHour < 10 + 50/60){
    available += 1.15;
  }

  if(currentHour < 14 + 50/60){
    available += 1.15;
  }

  if(currentHour < 22){
    available += Math.max(0, 22 - Math.max(currentHour, 16));
  }

  busy.forEach(item => {
    if(!busyAppliesToDate(item, now)) return;

    const start = timeToDecimal(item.start);
    const end = timeToDecimal(item.end);

    if(start === null || end === null) return;

    const overlapStart = Math.max(start, currentHour);
    const overlapEnd = Math.min(end, 22);

    if(overlapEnd > overlapStart){
      available -= overlapEnd - overlapStart;
    }
  });

  return Math.max(0, Number(available.toFixed(1)));
}

function getStressLevel(){
  const workload = calculateTotalWorkload();

  const urgentCount = assignments.filter(item =>
    !item.completed &&
    getDaysUntil(item.due) <= 2
  ).length;

  if(workload >= 16 || urgentCount >= 4){
    return {
      level:"Extreme",
      color:"#ef4444",
      message:"Too much is stacked up. Start with the highest priority task."
    };
  }

  if(workload >= 9 || urgentCount >= 2){
    return {
      level:"High",
      color:"#f59e0b",
      message:"You should plan work sessions soon."
    };
  }

  if(workload >= 4){
    return {
      level:"Moderate",
      color:"#eab308",
      message:"Manageable, but do not let it pile up."
    };
  }

  return {
    level:"Low",
    color:"#10b981",
    message:"Your workload looks manageable."
  };
}

function canFinishTonight(){
  return calculateTotalWorkload() <= calculateFreeHoursToday();
}

/* =========================================================
   SMART SCHEDULING ENGINE
   This creates study/work blocks BEFORE the due date.
   It uses open spaces like lunch, bus, and after school.
========================================================= */

function getAssignmentStartDate(assignment){
  const today = new Date();
  today.setHours(0,0,0,0);

  if(assignment.type === "Homework" && assignment.assigned){
    const assignedDate = parseLocalDate(assignment.assigned);

    if(assignedDate && assignedDate > today){
      return assignedDate;
    }

    return today;
  }

  return today;
}

function getAssignmentDueDate(assignment){
  const due = parseLocalDate(assignment.due);

  if(!due) return null;

  due.setHours(0,0,0,0);

  return due;
}

function getStudyWindowsForDate(date){
  const now = new Date();

  const isToday =
    formatDateLocal(date) === formatDateLocal(now);

  const currentHour =
    now.getHours() + now.getMinutes() / 60;

  let windows = [
    {
      start:10 + 50/60,
      end:12,
      label:"Lunch Work Block"
    },
    {
      start:14 + 50/60,
      end:16,
      label:"Bus Work Block"
    },
    {
      start:16,
      end:22,
      label:"After School Work Block"
    }
  ];

  /*
    If the planner is generating sessions for today,
    remove any part of a study window that already passed.
  */

  if(isToday){
    windows = windows
      .map(window => ({
        ...window,
        start:Math.max(window.start, currentHour)
      }))
      .filter(window => window.end - window.start >= 0.25);
  }

  busy.forEach(item => {
    if(!busyAppliesToDate(item, date)) return;

    const busyStart = timeToDecimal(item.start);
    const busyEnd = timeToDecimal(item.end);

    if(busyStart === null || busyEnd === null) return;

    windows = subtractBusyFromWindows(windows, busyStart, busyEnd);
  });

  return windows.filter(window => window.end - window.start >= 0.25);
}

function subtractBusyFromWindows(windows, busyStart, busyEnd){
  const updated = [];

  windows.forEach(window => {
    if(busyEnd <= window.start || busyStart >= window.end){
      updated.push(window);
      return;
    }

    if(busyStart > window.start){
      updated.push({
        start:window.start,
        end:busyStart,
        label:window.label
      });
    }

    if(busyEnd < window.end){
      updated.push({
        start:busyEnd,
        end:window.end,
        label:window.label
      });
    }
  });

  return updated;
}

function getDatesBetween(startDate, endDate){
  const dates = [];

  const current = new Date(startDate);
  current.setHours(0,0,0,0);

  const end = new Date(endDate);
  end.setHours(0,0,0,0);

  while(current <= end){
    if(!isWeekend(current)){
      dates.push(new Date(current));
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function generateSmartStudyPlan(){
  const plan = {};

  const usedWindowsByDate = {};

  const activeAssignments = getPriorityAssignments()
    .filter(assignment => {
      const due = getAssignmentDueDate(assignment);
      return due !== null && Number(assignment.hours || 1) > 0;
    });

  activeAssignments.forEach(assignment => {
    let remainingHours = Number(assignment.hours || 1);

    const startDate = getAssignmentStartDate(assignment);
    const dueDate = getAssignmentDueDate(assignment);

    if(!dueDate) return;

    /*
      To make sure the assignment is completed BY the due date,
      the planner tries to schedule it before the due day.
      If there is no time before, it will use the due day as a last resort.
    */

    let finishByDate = new Date(dueDate);
    finishByDate.setDate(finishByDate.getDate() - 1);

    if(finishByDate < startDate){
      finishByDate = new Date(dueDate);
    }

    const usableDates = getDatesBetween(startDate, finishByDate);

    usableDates.forEach(date => {
      if(remainingHours <= 0) return;

      const dateString = formatDateLocal(date);

      if(!plan[dateString]){
        plan[dateString] = [];
      }

      if(!usedWindowsByDate[dateString]){
        usedWindowsByDate[dateString] = [];
      }

      let windows = getStudyWindowsForDate(date);

      usedWindowsByDate[dateString].forEach(used => {
        windows = subtractBusyFromWindows(windows, used.start, used.end);
      });

      windows.forEach(window => {
        if(remainingHours <= 0) return;

        const available = window.end - window.start;

        if(available < 0.25) return;

        const chunk = Math.min(
          remainingHours,
          available,
          1
        );

        const session = {
          id:`study-${assignment.id}-${dateString}-${window.start}`,
          assignmentId:assignment.id,
          title:assignment.title,
          className:assignment.className,
          type:assignment.type,
          due:assignment.due,
          start:window.start,
          end:window.start + chunk,
          label:window.label
        };

        plan[dateString].push(session);

        usedWindowsByDate[dateString].push({
          start:session.start,
          end:session.end
        });

        remainingHours -= chunk;
        remainingHours = Number(remainingHours.toFixed(2));
      });
    });
  });

  return plan;
}

/* =========================================================
   AI PANEL
========================================================= */

function renderAIInsights(){
  const sidebar = document.querySelector(".sidebar");

  if(!sidebar) return;

  let panel = document.getElementById("aiInsights");

  if(!panel){
    panel = document.createElement("div");
    panel.id = "aiInsights";
    panel.className = "card";
    sidebar.prepend(panel);
  }

  const best = getBestTask();
  const stress = getStressLevel();
  const freeTime = calculateFreeHoursToday();
  const workload = calculateTotalWorkload();
  const finishTonight = canFinishTonight();

  panel.innerHTML = `
    <div class="section-title">AI Planner</div>

    <div style="margin-bottom:16px;">
      <div style="font-size:0.75rem; font-weight:900; opacity:0.65; margin-bottom:5px;">
        RECOMMENDED NEXT TASK
      </div>

      <div style="font-size:1.18rem; font-weight:950;">
        ${best ? best.title : "Nothing due"}
      </div>

      <div style="font-size:0.82rem; opacity:0.72; margin-top:5px;">
        ${best ? `${best.className} · ${best.type} · Due ${best.due}` : "You are caught up."}
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
      <div style="padding:12px; border-radius:16px; background:rgba(255,255,255,0.06);">
        <div style="font-size:0.72rem; opacity:0.65; font-weight:900;">FREE TODAY</div>
        <div style="font-size:1.35rem; font-weight:950;">${freeTime}h</div>
      </div>

      <div style="padding:12px; border-radius:16px; background:rgba(255,255,255,0.06);">
        <div style="font-size:0.72rem; opacity:0.65; font-weight:900;">WORKLOAD</div>
        <div style="font-size:1.35rem; font-weight:950;">${workload}h</div>
      </div>
    </div>

    <div style="margin-bottom:16px;">
      <div style="font-size:0.75rem; font-weight:900; opacity:0.65; margin-bottom:5px;">
        STRESS LEVEL
      </div>

      <div style="font-size:1.18rem; font-weight:950; color:${stress.color};">
        ${stress.level}
      </div>

      <div style="font-size:0.82rem; opacity:0.72; margin-top:5px;">
        ${stress.message}
      </div>
    </div>

    <div>
      <div style="font-size:0.75rem; font-weight:900; opacity:0.65; margin-bottom:5px;">
        CAN YOU FINISH TONIGHT?
      </div>

      <div style="font-size:1.18rem; font-weight:950; color:${finishTonight ? "#10b981" : "#ef4444"};">
        ${finishTonight ? "YES" : "NO"}
      </div>
    </div>
  `;
}

function initializeAI(){
  renderAIInsights();
}
