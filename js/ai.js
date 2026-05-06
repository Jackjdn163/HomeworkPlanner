function getDaysUntil(dateString){
  const now = new Date();
  now.setHours(0,0,0,0);

  const target = parseLocalDate(dateString);

  if(!target) return 999;

  target.setHours(0,0,0,0);

  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function getPlannerSettings(){
  const breakInput =
    document.getElementById("breakMinutes");

  const workInput =
    document.getElementById("workHoursBeforeBreak");

  const breakMinutes =
    Number(
      localStorage.getItem("breakMinutes") ||
      breakInput?.value ||
      10
    );

  const workHoursBeforeBreak =
    Number(
      localStorage.getItem("workHoursBeforeBreak") ||
      workInput?.value ||
      1
    );

  return {
    breakMinutes,
    workHoursBeforeBreak
  };
}

function savePlannerSettings(){
  const breakMinutes =
    Number(
      document.getElementById("breakMinutes").value || 10
    );

  const workHoursBeforeBreak =
    Number(
      document.getElementById("workHoursBeforeBreak").value || 1
    );

  localStorage.setItem(
    "breakMinutes",
    breakMinutes
  );

  localStorage.setItem(
    "workHoursBeforeBreak",
    workHoursBeforeBreak
  );

  renderAll();
}

function calculatePriority(assignment){
  if(assignment.completed) return -999;

  let score = 0;

  const days = getDaysUntil(assignment.due);

  if(days <= 0){
    score += 180;
  }else if(days <= 1){
    score += 145;
  }else if(days <= 2){
    score += 115;
  }else if(days <= 3){
    score += 90;
  }else if(days <= 5){
    score += 65;
  }else if(days <= 7){
    score += 45;
  }else{
    score += 20;
  }

  score += Number(assignment.hours || 1) * 10;

  if(assignment.type === "Test") score += 100;
  if(assignment.type === "Project") score += 90;
  if(assignment.type === "Essay") score += 75;
  if(assignment.type === "Quiz") score += 60;
  if(assignment.type === "Homework") score += 30;
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
    .sort((a,b) => {
      const dueDiff =
        new Date(a.due) - new Date(b.due);

      if(dueDiff !== 0){
        return dueDiff;
      }

      return b.priority - a.priority;
    });
}

function getBestTask(){
  return getPriorityAssignments()[0] || null;
}

function calculateTotalWorkload(){
  return assignments
    .filter(item => !item.completed)
    .reduce(
      (sum,item) => sum + Number(item.hours || 1),
      0
    );
}

function calculateFreeHoursToday(){
  const now = new Date();

  const currentHour =
    now.getHours() + now.getMinutes()/60;

  let available = 0;

  if(currentHour < 10 + 50/60){
    available += 1.15;
  }

  if(currentHour < 14 + 50/60){
    available += 1.15;
  }

  if(currentHour < 22){
    available +=
      Math.max(
        0,
        22 - Math.max(currentHour,16)
      );
  }

  busy.forEach(item => {
    if(!busyAppliesToDate(item, now)) return;

    const start =
      timeToDecimal(item.start);

    const end =
      timeToDecimal(item.end);

    if(
      start === null ||
      end === null
    ) return;

    const overlapStart =
      Math.max(start,currentHour);

    const overlapEnd =
      Math.min(end,22);

    if(overlapEnd > overlapStart){
      available -= overlapEnd - overlapStart;
    }
  });

  return Math.max(
    0,
    Number(available.toFixed(1))
  );
}

function getStressLevel(){
  const workload = calculateTotalWorkload();

  const urgentCount =
    assignments.filter(item =>
      !item.completed &&
      getDaysUntil(item.due) <= 2
    ).length;

  if(workload >= 16 || urgentCount >= 4){
    return {
      level:"Extreme",
      color:"#ef4444",
      message:"Too much is stacked up. Start with the highest priority work."
    };
  }

  if(workload >= 9 || urgentCount >= 2){
    return {
      level:"High",
      color:"#f59e0b",
      message:"You should spread your work across multiple days."
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

function getAssignmentStartDate(assignment){
  const today = new Date();
  today.setHours(0,0,0,0);

  if(
    assignment.type === "Homework" &&
    assignment.assigned
  ){
    const assignedDate =
      parseLocalDate(assignment.assigned);

    if(assignedDate && assignedDate > today){
      return assignedDate;
    }
  }

  return today;
}

function getAssignmentDueDate(assignment){
  const due =
    parseLocalDate(assignment.due);

  if(!due) return null;

  due.setHours(0,0,0,0);

  return due;
}

function subtractBusyFromWindows(windows,busyStart,busyEnd){
  const updated = [];

  windows.forEach(window => {
    if(
      busyEnd <= window.start ||
      busyStart >= window.end
    ){
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

function getStudyWindowsForDate(date){
  const now = new Date();

  const isToday =
    formatDateLocal(date) === formatDateLocal(now);

  const currentHour =
    now.getHours() + now.getMinutes()/60;

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

  if(isToday){
    windows = windows
      .map(window => ({
        ...window,
        start:Math.max(window.start,currentHour)
      }))
      .filter(window =>
        window.end - window.start >= 0.25
      );
  }

  busy.forEach(item => {
    if(!busyAppliesToDate(item,date)) return;

    const busyStart =
      timeToDecimal(item.start);

    const busyEnd =
      timeToDecimal(item.end);

    if(
      busyStart === null ||
      busyEnd === null
    ) return;

    windows =
      subtractBusyFromWindows(
        windows,
        busyStart,
        busyEnd
      );
  });

  return windows.filter(window =>
    window.end - window.start >= 0.25
  );
}

function getDatesBetween(startDate,endDate){
  const dates = [];

  const current = new Date(startDate);
  current.setHours(0,0,0,0);

  const end = new Date(endDate);
  end.setHours(0,0,0,0);

  while(current <= end){
    if(!isWeekend(current)){
      dates.push(new Date(current));
    }

    current.setDate(
      current.getDate() + 1
    );
  }

  return dates;
}

function getAvailableWindowsForDate(date,usedWindows){
  let windows =
    getStudyWindowsForDate(date);

  usedWindows.forEach(used => {
    windows =
      subtractBusyFromWindows(
        windows,
        used.start,
        used.end
      );
  });

  return windows.filter(window =>
    window.end - window.start >= 0.25
  );
}

function addUsedWindow(usedWindowsByDate,dateString,start,end){
  if(!usedWindowsByDate[dateString]){
    usedWindowsByDate[dateString] = [];
  }

  usedWindowsByDate[dateString].push({
    start,
    end
  });
}

function snapHour(hour){
  return Math.round(hour * 12) / 12;
}

/*
  This version makes breaks attach directly after work,
  and the next task attaches directly after the break.
*/

function generateSmartStudyPlan(){
  const plan = {};
  const usedWindowsByDate = {};
  const dailyLoad = {};
  const workSinceBreak = {};

  const settings =
    getPlannerSettings();

  const breakHours =
    settings.breakMinutes / 60;

  const workLimit =
    settings.workHoursBeforeBreak;

  const activeAssignments =
    getPriorityAssignments()
      .filter(assignment => {
        const due =
          getAssignmentDueDate(assignment);

        return (
          due !== null &&
          Number(assignment.hours || 1) > 0
        );
      });

  activeAssignments.forEach(assignment => {
    let remainingHours =
      Number(assignment.hours || 1);

    const startDate =
      getAssignmentStartDate(assignment);

    const dueDate =
      getAssignmentDueDate(assignment);

    if(!dueDate) return;

    let finishByDate =
      new Date(dueDate);

    finishByDate.setDate(
      finishByDate.getDate() - 1
    );

    if(finishByDate < startDate){
      finishByDate =
        new Date(dueDate);
    }

    const usableDates =
      getDatesBetween(
        startDate,
        finishByDate
      );

    while(remainingHours > 0){
      const candidates = [];

      usableDates.forEach((date,index) => {
        const dateString =
          formatDateLocal(date);

        if(!usedWindowsByDate[dateString]){
          usedWindowsByDate[dateString] = [];
        }

        if(!dailyLoad[dateString]){
          dailyLoad[dateString] = 0;
        }

        if(workSinceBreak[dateString] === undefined){
          workSinceBreak[dateString] = 0;
        }

        const windows =
          getAvailableWindowsForDate(
            date,
            usedWindowsByDate[dateString]
          );

        windows.forEach(window => {
          if(window.end - window.start < 0.25) return;

          candidates.push({
            date,
            dateString,
            window,
            dateIndex:index,
            score:
              dailyLoad[dateString] * 4 +
              index * 0.25
          });
        });
      });

      if(candidates.length === 0){
        break;
      }

      candidates.sort((a,b) =>
        a.score - b.score
      );

      const chosen =
        candidates[0];

      const dateString =
        chosen.dateString;

      if(!plan[dateString]){
        plan[dateString] = [];
      }

      let start =
        snapHour(chosen.window.start);

      let windowEnd =
        snapHour(chosen.window.end);

      let available =
        windowEnd - start;

      if(available < 0.25){
        addUsedWindow(
          usedWindowsByDate,
          dateString,
          chosen.window.start,
          chosen.window.end
        );

        continue;
      }

      let maxWorkBeforeBreak =
        workLimit - workSinceBreak[dateString];

      if(maxWorkBeforeBreak <= 0){
        maxWorkBeforeBreak = workLimit;
        workSinceBreak[dateString] = 0;
      }

      let chunk =
        Math.min(
          remainingHours,
          available,
          1,
          maxWorkBeforeBreak
        );

      chunk =
        snapHour(chunk);

      if(chunk < 0.25){
        addUsedWindow(
          usedWindowsByDate,
          dateString,
          start,
          windowEnd
        );

        continue;
      }

      const sessionStart =
        start;

      const sessionEnd =
        snapHour(sessionStart + chunk);

      const session = {
        id:`study-${assignment.id}-${dateString}-${sessionStart}`,
        kind:"study",
        assignmentId:assignment.id,
        title:assignment.title,
        className:assignment.className,
        type:assignment.type,
        due:assignment.due,
        start:sessionStart,
        end:sessionEnd,
        label:"AI Scheduled Work Block"
      };

      plan[dateString].push(session);

      addUsedWindow(
        usedWindowsByDate,
        dateString,
        sessionStart,
        sessionEnd
      );

      dailyLoad[dateString] +=
        sessionEnd - sessionStart;

      workSinceBreak[dateString] +=
        sessionEnd - sessionStart;

      remainingHours -=
        sessionEnd - sessionStart;

      remainingHours =
        Number(remainingHours.toFixed(2));

      /*
        If work limit has been reached, immediately attach break
        to the bottom of the work block.
      */

      const shouldBreak =
        workSinceBreak[dateString] >= workLimit &&
        remainingHours > 0;

      const breakStart =
        sessionEnd;

      const breakEnd =
        snapHour(breakStart + breakHours);

      if(
        shouldBreak &&
        breakEnd <= windowEnd
      ){
        const breakSession = {
          id:`break-${dateString}-${breakStart}`,
          kind:"break",
          title:"Break",
          className:"Break",
          type:"Break",
          due:null,
          start:breakStart,
          end:breakEnd,
          label:`${settings.breakMinutes} min break`
        };

        plan[dateString].push(breakSession);

        addUsedWindow(
          usedWindowsByDate,
          dateString,
          breakStart,
          breakEnd
        );

        dailyLoad[dateString] +=
          breakEnd - breakStart;

        workSinceBreak[dateString] = 0;
      }
    }
  });

  Object.keys(plan).forEach(dateString => {
    plan[dateString].sort((a,b) =>
      a.start - b.start
    );
  });

  return plan;
}

function getCurrentPlannedSession(){
  const plan =
    generateSmartStudyPlan();

  const now = new Date();

  const todayString =
    formatDateLocal(now);

  const currentHour =
    now.getHours() + now.getMinutes()/60;

  const sessions =
    plan[todayString] || [];

  return sessions.find(session =>
    currentHour >= session.start &&
    currentHour < session.end
  ) || null;
}

function renderAIInsights(){
  const sidebar =
    document.querySelector(".sidebar");

  if(!sidebar) return;

  let panel =
    document.getElementById("aiInsights");

  if(!panel){
    panel =
      document.createElement("div");

    panel.id = "aiInsights";
    panel.className = "card";

    sidebar.prepend(panel);
  }

  const best = getBestTask();
  const stress = getStressLevel();
  const freeTime = calculateFreeHoursToday();
  const workload = calculateTotalWorkload();
  const finishTonight = canFinishTonight();
  const current = getCurrentPlannedSession();

  panel.innerHTML = `
    <div class="section-title">AI Planner</div>

    <div class="current-assignment-box">
      <div style="font-size:0.75rem; font-weight:900; opacity:0.65; margin-bottom:5px;">
        CURRENT ASSIGNMENT
      </div>

      <div style="font-size:1.15rem; font-weight:950;">
        ${
          current
          ? current.kind === "break"
            ? "Take a Break"
            : current.title
          : "No current work block"
        }
      </div>

      <div style="font-size:0.82rem; opacity:0.72; margin-top:5px;">
        ${
          current
          ? current.kind === "break"
            ? current.label
            : `${current.className} · ${decimalHourToTime(current.start)} - ${decimalHourToTime(current.end)}`
          : "The planner will show your next scheduled work block here."
        }
      </div>
    </div>

    <div style="margin-top:16px; margin-bottom:16px;">
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

function decimalHourToTime(decimal){
  const hour = Math.floor(decimal);
  const minutes = Math.round((decimal - hour) * 60);

  const date = new Date();

  date.setHours(hour, minutes, 0, 0);

  return date.toLocaleTimeString(
    "en-US",
    {
      hour:"numeric",
      minute:"2-digit"
    }
  );
}

function initializeAI(){
  renderAIInsights();
}
