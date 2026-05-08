const PRIORITY_WEIGHTS = {
  Low: -10,
  Medium: 0,
  High: 35,
  Urgent: 70
};

const TYPE_WEIGHTS = {
  Homework: 25,
  Project: 85,
  Essay: 75,
  Quiz: 55,
  Test: 95,
  Studying: 35,
  Other: 20
};

const LOCKED_PLAN_STORAGE_KEY = "lockedStudyPlan";
const LOCKED_PLAN_DIRTY_KEY = "lockedStudyPlanDirty";

let lockedStudyPlan = normalizeLockedStudyPlan(loadJSON(LOCKED_PLAN_STORAGE_KEY, null));
let lockedStudyPlanDirty = Boolean(loadJSON(LOCKED_PLAN_DIRTY_KEY, false));

function normalizeLockedStudyPlan(rawPlan){
  if(
    !rawPlan ||
    typeof rawPlan !== "object" ||
    !rawPlan.sessionsByDate ||
    typeof rawPlan.sessionsByDate !== "object" ||
    !Array.isArray(rawPlan.unscheduledAssignments)
  ){
    return null;
  }

  return {
    sessionsByDate: rawPlan.sessionsByDate,
    unscheduledAssignments: rawPlan.unscheduledAssignments,
    totalScheduledHours: Number(rawPlan.totalScheduledHours || 0),
    remainingWorkHours: Number(rawPlan.remainingWorkHours || 0),
    generatedAt: typeof rawPlan.generatedAt === "string"
      ? rawPlan.generatedAt
      : ""
  };
}

function saveLockedStudyPlanState(){
  if(lockedStudyPlan){
    saveJSON(LOCKED_PLAN_STORAGE_KEY, lockedStudyPlan);
  }else{
    localStorage.removeItem(LOCKED_PLAN_STORAGE_KEY);
  }

  saveJSON(LOCKED_PLAN_DIRTY_KEY, lockedStudyPlanDirty);
}

function buildLockedStudyPlan(planResult){
  return {
    ...planResult,
    generatedAt: getNow().toISOString()
  };
}

function formatLockedPlanTimestamp(value){
  if(!value){
    return "not generated yet";
  }

  const date = new Date(value);

  if(Number.isNaN(date.getTime())){
    return "not generated yet";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function markSmartPlanDirty(){
  lockedStudyPlanDirty = true;
  saveLockedStudyPlanState();
}

function clearLockedStudyPlan(){
  lockedStudyPlan = null;
  lockedStudyPlanDirty = false;
  saveLockedStudyPlanState();
}

function regenerateLockedStudyPlan(options = {}){
  lockedStudyPlan = buildLockedStudyPlan(generateSmartStudyPlan());
  lockedStudyPlanDirty = false;
  saveLockedStudyPlanState();

  if(!options.skipRender){
    renderAll();
  }

  return lockedStudyPlan;
}

function getActiveSmartStudyPlan(){
  if(!lockedStudyPlan){
    return regenerateLockedStudyPlan({ skipRender: true });
  }

  return lockedStudyPlan;
}

function renderRegenerateScheduleButton(){
  const button = document.getElementById("regenerateScheduleButton");

  if(!button){
    return;
  }

  button.textContent = lockedStudyPlanDirty
    ? "Regenerate Schedule *"
    : "Regenerate Schedule";
  button.classList.toggle("attention-ghost", lockedStudyPlanDirty);
  button.title = lockedStudyPlanDirty
    ? `Schedule changes are waiting. Last generated ${formatLockedPlanTimestamp(lockedStudyPlan?.generatedAt)}.`
    : `Study blocks are locked. Last generated ${formatLockedPlanTimestamp(lockedStudyPlan?.generatedAt)}.`;
}

function getDaysUntil(dateString){
  const now = getNow();
  now.setHours(0, 0, 0, 0);

  const target = parseLocalDate(dateString);

  if(!target){
    return 999;
  }

  target.setHours(0, 0, 0, 0);

  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function getPlannerSettings(){
  const breakInput = document.getElementById("breakMinutes");
  const workInput = document.getElementById("workMinutesBeforeBreak");
  const latestStudyEndInput = document.getElementById("latestStudyEnd");
  const storedBreakMinutes = Number(localStorage.getItem("breakMinutes"));
  const storedWorkMinutes = Number(localStorage.getItem("workMinutesBeforeBreak"));
  const storedLegacyWorkHours = Number(localStorage.getItem("workHoursBeforeBreak"));
  const inputBreakMinutes = Number(breakInput?.value || 10);
  const inputWorkMinutes = Number(workInput?.value || 60);

  return {
    breakMinutes: Number.isFinite(storedBreakMinutes) && storedBreakMinutes > 0
      ? storedBreakMinutes
      : inputBreakMinutes,
    workMinutesBeforeBreak: normalizeWorkMinutesBeforeBreak(
      storedWorkMinutes,
      storedLegacyWorkHours,
      inputWorkMinutes
    ),
    latestStudyEnd: localStorage.getItem("latestStudyEnd") || latestStudyEndInput?.value || "22:00"
  };
}

function normalizeWorkMinutesBeforeBreak(minutesValue, legacyHoursValue, fallbackMinutes = 60){
  if(Number.isFinite(minutesValue) && minutesValue > 0){
    return Math.round(minutesValue);
  }

  if(Number.isFinite(legacyHoursValue) && legacyHoursValue > 0){
    return Math.round(legacyHoursValue * 60);
  }

  return Math.round(fallbackMinutes);
}

function getPlannerSettingsWarnings(breakMinutes, workMinutesBeforeBreak){
  const warnings = [];

  if(workMinutesBeforeBreak < 60){
    warnings.push(
      `An hour of work is recommended before a break. You currently have ${workMinutesBeforeBreak} minutes of work before each break.`
    );
  }

  if(breakMinutes > workMinutesBeforeBreak / 4){
    warnings.push(
      `Break too long: ${breakMinutes} minutes is more than 25% of ${workMinutesBeforeBreak} minutes of work.`
    );
  }

  return warnings;
}

function renderPlannerSettingsHint(){
  const hint = document.getElementById("plannerSettingsHint");

  if(!hint){
    return;
  }

  const settings = getPlannerSettings();
  hint.textContent = `Current pacing: ${settings.workMinutesBeforeBreak} min work, then ${settings.breakMinutes} min break. Recommended: at least 60 min of work before each break.`;
}

function savePlannerSettings(){
  const breakMinutes = Number(document.getElementById("breakMinutes").value || 10);
  const workMinutesBeforeBreak = Number(document.getElementById("workMinutesBeforeBreak").value || 60);
  const latestStudyEnd = document.getElementById("latestStudyEnd").value || "22:00";

  if(
    !Number.isFinite(breakMinutes) ||
    !Number.isFinite(workMinutesBeforeBreak) ||
    breakMinutes <= 0 ||
    workMinutesBeforeBreak <= 0
  ){
    alert("Please enter positive minute values for both break length and work before break.");
    return;
  }

  const warnings = getPlannerSettingsWarnings(
    breakMinutes,
    workMinutesBeforeBreak
  );

  if(
    warnings.length > 0 &&
    !window.confirm(
      `${warnings.join("\n\n")}\n\nDo you want to save these study settings anyway?`
    )
  ){
    return;
  }

  localStorage.setItem("breakMinutes", breakMinutes);
  localStorage.setItem("workMinutesBeforeBreak", workMinutesBeforeBreak);
  localStorage.removeItem("workHoursBeforeBreak");
  localStorage.setItem("latestStudyEnd", latestStudyEnd);
  markSmartPlanDirty();

  if(typeof queueCloudSync === "function"){
    queueCloudSync("planner settings");
  }

  renderPlannerSettingsHint();
  renderAll();
}

function getLatestStudyEndDecimal(){
  const latestStudyEnd = timeToDecimal(
    getPlannerSettings().latestStudyEnd,
    { midnightAs24: true }
  );

  return latestStudyEnd === null
    ? SCHOOL_DAY.defaultStudyEnd
    : latestStudyEnd;
}

function getPriorityWeight(priority){
  return PRIORITY_WEIGHTS[priority] ?? PRIORITY_WEIGHTS.Medium;
}

function getTypeWeight(type){
  return TYPE_WEIGHTS[type] ?? TYPE_WEIGHTS.Other;
}

function calculatePriority(assignment){
  if(assignment.completed){
    return -999;
  }

  const dueInDays = getDaysUntil(assignment.due);
  const estimatedHours = Number(assignment.hours || 1);
  let score = 0;

  if(dueInDays <= 0){
    score += 220;
  }else if(dueInDays === 1){
    score += 170;
  }else if(dueInDays <= 2){
    score += 140;
  }else if(dueInDays <= 4){
    score += 105;
  }else if(dueInDays <= 7){
    score += 65;
  }else{
    score += 30;
  }

  score += estimatedHours * 14;
  score += getPriorityWeight(assignment.priority);
  score += getTypeWeight(assignment.type);
  score += clampGradeWeight(assignment.gradeWeight) * 1.8;

  if(assignment.studyMode === "Test Prep"){
    score += 22;
  }

  if(assignment.energyLevel === "High"){
    score += 12;
  }

  const assignedDate = parseLocalDate(assignment.assigned);
  const dueDate = parseLocalDate(assignment.due);

  if(assignedDate && dueDate){
    const availableDays = Math.max(
      1,
      Math.ceil((dueDate - assignedDate) / (1000 * 60 * 60 * 24))
    );

    score += (estimatedHours / availableDays) * 26;
  }

  if(isRecoveryModeEnabled()){
    if(dueInDays <= 0){
      score += 65;
    }else if(dueInDays <= 2){
      score += 28;
    }
  }

  return Number(score.toFixed(2));
}

function getPriorityAssignments(){
  return assignments
    .map(item => ({
      ...item,
      priorityScore: calculatePriority(item)
    }))
    .filter(item => !item.completed)
    .sort((a, b) => {
      const dueDifference = parseLocalDate(a.due) - parseLocalDate(b.due);

      if(dueDifference !== 0){
        return dueDifference;
      }

      return b.priorityScore - a.priorityScore;
    });
}

function calculateTotalWorkload(){
  return assignments
    .filter(item => !item.completed)
    .reduce((sum, item) => sum + Number(item.hours || 1), 0);
}

function getAssignmentStartDate(assignment){
  const today = getNow();
  today.setHours(0, 0, 0, 0);

  const assignedDate = parseLocalDate(assignment.assigned);

  if(!assignedDate){
    return today;
  }

  assignedDate.setHours(0, 0, 0, 0);

  return assignedDate > today ? assignedDate : today;
}

function getAssignmentDueDate(assignment){
  const dueDate = parseLocalDate(assignment.due);

  if(!dueDate){
    return null;
  }

  dueDate.setHours(0, 0, 0, 0);
  return dueDate;
}

function getBaseStudyWindowsForDate(date){
  const latestStudyEnd = isRecoveryModeEnabled()
    ? Math.max(getLatestStudyEndDecimal(), 23)
    : getLatestStudyEndDecimal();

  if(isWeekend(date)){
    return latestStudyEnd - SCHOOL_DAY.weekendStudyStart >= 0.25
      ? [{
        start: SCHOOL_DAY.weekendStudyStart,
        end: latestStudyEnd,
        label: "Weekend Focus Window",
        visualClassName: "weekend-flex-event"
      }]
      : [];
  }

  const windows = [{
    start: SCHOOL_DAY.lunchStart,
    end: SCHOOL_DAY.lunchEnd,
    label: "Lunch Flex Block",
    visualClassName: "lunch-flex-event"
  }];

  if(latestStudyEnd > SCHOOL_DAY.busEnd){
    windows.push({
      start: SCHOOL_DAY.busEnd,
      end: latestStudyEnd,
      label: "After School Focus Window",
      visualClassName: "afterschool-flex-event"
    });
  }

  return windows;
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
        ...window,
        end: busyStart
      });
    }

    if(busyEnd < window.end){
      updated.push({
        ...window,
        start: busyEnd
      });
    }
  });

  return updated;
}

function getStudyWindowsForDate(date, options = {}){
  const now = getNow();
  const isToday = formatDateLocal(date) === formatDateLocal(now);
  const currentHour = now.getHours() + now.getMinutes() / 60;

  let windows = getBaseStudyWindowsForDate(date).map(window => ({ ...window }));

  if(isToday && !options.ignoreCurrentTime){
    windows = windows
      .map(window => ({
        ...window,
        start: Math.max(window.start, currentHour)
      }))
      .filter(window => window.end - window.start >= 0.25);
  }

  if(!options.ignoreBusy){
    busy.forEach(item => {
      if(!busyAppliesToDate(item, date)){
        return;
      }

      const busyRange = getBusyRange(item);

      if(!busyRange){
        return;
      }

      windows = subtractBusyFromWindows(
        windows,
        busyRange.start,
        busyRange.end
      );
    });

    getWhatIfBlocksForDate(date).forEach(item => {
      const range = getBusyRange(item);

      if(!range){
        return;
      }

      windows = subtractBusyFromWindows(
        windows,
        range.start,
        range.end
      );
    });
  }

  return windows.filter(window => window.end - window.start >= 0.25);
}

function getPlanningDatesBetween(startDate, endDate){
  const dates = [];
  const current = new Date(startDate);
  const finish = new Date(endDate);

  current.setHours(0, 0, 0, 0);
  finish.setHours(0, 0, 0, 0);

  while(current <= finish){
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function getAvailableWindowsForDate(date, usedWindows){
  let windows = getStudyWindowsForDate(date);

  usedWindows.forEach(used => {
    windows = subtractBusyFromWindows(windows, used.start, used.end);
  });

  return windows.filter(window => window.end - window.start >= 0.25);
}

function addUsedWindow(usedWindowsByDate, dateString, start, end){
  if(!usedWindowsByDate[dateString]){
    usedWindowsByDate[dateString] = [];
  }

  usedWindowsByDate[dateString].push({ start, end });
}

function snapHour(hour){
  return Math.round(hour * 12) / 12;
}

function getPreferredChunkHours(assignment){
  if(assignment.studyMode === "Quick Review"){
    return 0.5;
  }

  if(assignment.studyMode === "Deep Work"){
    return 1.5;
  }

  if(assignment.studyMode === "Test Prep"){
    return 0.75;
  }

  if(assignment.type === "Project" || assignment.type === "Essay" || assignment.type === "Test"){
    return 1.25;
  }

  if(assignment.type === "Quiz" || assignment.type === "Studying"){
    return 1;
  }

  if(assignment.priority === "Urgent"){
    return 1;
  }

  return 0.75;
}

function buildAssignmentReason(assignment){
  const dueInDays = getDaysUntil(assignment.due);
  const dueLabel = dueInDays <= 0
    ? "due now"
    : dueInDays === 1
      ? "due tomorrow"
      : `due in ${dueInDays} days`;
  const gradeImpact = clampGradeWeight(assignment.gradeWeight) > 0
    ? ` · ${assignment.gradeWeight}% of grade`
    : "";

  return `${assignment.priority} priority · ${dueLabel} · ${formatHoursValue(assignment.hours)} remaining${gradeImpact}`;
}

function generateSmartStudyPlan(){
  const sessionsByDate = {};
  const usedWindowsByDate = {};
  const dailyStudyLoad = {};
  const workSinceBreak = {};
  const unscheduledAssignments = [];
  const settings = getPlannerSettings();
  const breakHours = settings.breakMinutes / 60;
  const workLimit = settings.workMinutesBeforeBreak / 60;
  const preferredDailyLimitHours = getPreferredDailyWorkLimitHours();
  const recoveryMode = isRecoveryModeEnabled();

  const activeAssignments = getPriorityAssignments().filter(assignment => {
    const dueDate = getAssignmentDueDate(assignment);

    return dueDate !== null && Number(assignment.hours || 1) > 0;
  });

  activeAssignments.forEach(assignment => {
    let remainingHours = Number(assignment.hours || 1);
    const startDate = getAssignmentStartDate(assignment);
    const dueDate = getAssignmentDueDate(assignment);
    const dueInDays = getDaysUntil(assignment.due);

    if(!dueDate){
      return;
    }

    let finishByDate = new Date(dueDate);
    finishByDate.setDate(finishByDate.getDate() - 1);

    if(finishByDate < startDate){
      finishByDate = new Date(dueDate);
    }

    const planningDates = getPlanningDatesBetween(startDate, finishByDate);

    while(remainingHours > 0.01){
      const candidates = [];

      planningDates.forEach((date, index) => {
        const dateString = formatDateLocal(date);

        if(!usedWindowsByDate[dateString]){
          usedWindowsByDate[dateString] = [];
        }

        if(dailyStudyLoad[dateString] === undefined){
          dailyStudyLoad[dateString] = 0;
        }

        if(workSinceBreak[dateString] === undefined){
          workSinceBreak[dateString] = 0;
        }

        const windows = getAvailableWindowsForDate(date, usedWindowsByDate[dateString]);

        windows.forEach(window => {
          const available = window.end - window.start;

          if(available < 0.25){
            return;
          }

          const remainingBeforeBreak = Math.max(0, workLimit - workSinceBreak[dateString]) || workLimit;
          const expectedChunk = snapHour(
            Math.min(
              remainingHours,
              available,
              getPreferredChunkHours(assignment),
              remainingBeforeBreak
            )
          );

          if(expectedChunk < 0.25){
            return;
          }

          const energyPenalty = getEnergyPenalty(assignment, window);
          const frontloadBias = assignment.studyMode === "Test Prep"
            ? index * 0.6
            : index * 1.15;
          const dueSoonBias = recoveryMode && dueInDays <= 1
            ? -0.95
            : 0;
          const effectivePreferredDailyLimit = recoveryMode
            ? preferredDailyLimitHours * 1.15
            : preferredDailyLimitHours;
          const projectedLoad = dailyStudyLoad[dateString] + expectedChunk;
          const overflowHours = Math.max(0, projectedLoad - effectivePreferredDailyLimit);
          const preferredLimitPenaltyMultiplier = dueInDays <= 0
            ? 0.25
            : dueInDays === 1
              ? 1.1
              : dueInDays === 2
                ? 3.5
                : 6;
          const preferredLimitPenalty = overflowHours * preferredLimitPenaltyMultiplier;

          candidates.push({
            date,
            dateString,
            window,
            score:
              dailyStudyLoad[dateString] * 3.5 +
              frontloadBias +
              window.start * 0.02 +
              energyPenalty +
              dueSoonBias +
              preferredLimitPenalty
          });
        });
      });

      if(candidates.length === 0){
        break;
      }

      candidates.sort((a, b) => a.score - b.score);

      const breakCandidate = candidates.find(candidate => {
        if(workSinceBreak[candidate.dateString] < workLimit){
          return false;
        }

        const start = snapHour(candidate.window.start);
        const end = snapHour(candidate.window.end);

        return end - start >= breakHours;
      });

      if(breakCandidate){
        const dateString = breakCandidate.dateString;

        if(!sessionsByDate[dateString]){
          sessionsByDate[dateString] = [];
        }

        const breakStart = snapHour(breakCandidate.window.start);
        const breakEnd = snapHour(breakStart + breakHours);

        sessionsByDate[dateString].push({
          id: `break-${dateString}-${breakStart}`,
          kind: "break",
          title: "Break",
          className: "Break",
          type: "Break",
          priority: "Break",
          due: null,
          start: breakStart,
          end: breakEnd,
          label: `${settings.breakMinutes} min break`
        });

        addUsedWindow(usedWindowsByDate, dateString, breakStart, breakEnd);
        workSinceBreak[dateString] = 0;
        continue;
      }

      const chosen = candidates[0];
      const dateString = chosen.dateString;
      const start = snapHour(chosen.window.start);
      const windowEnd = snapHour(chosen.window.end);
      const available = windowEnd - start;

      if(available < 0.25){
        addUsedWindow(usedWindowsByDate, dateString, chosen.window.start, chosen.window.end);
        continue;
      }

      const remainingBeforeBreak = Math.max(0, workLimit - workSinceBreak[dateString]) || workLimit;
      let chunk = Math.min(
        remainingHours,
        available,
        getPreferredChunkHours(assignment),
        remainingBeforeBreak
      );

      chunk = snapHour(chunk);

      if(chunk < 0.25){
        workSinceBreak[dateString] = workLimit;
        continue;
      }

      const sessionEnd = snapHour(start + chunk);

      if(!sessionsByDate[dateString]){
        sessionsByDate[dateString] = [];
      }

      sessionsByDate[dateString].push({
        id: `study-${assignment.id}-${dateString}-${start}`,
        kind: "study",
        assignmentId: assignment.id,
        title: assignment.title,
        className: assignment.className,
        type: assignment.type,
        priority: assignment.priority,
        studyMode: assignment.studyMode,
        energyLevel: assignment.energyLevel,
        gradeWeight: assignment.gradeWeight,
        resourceUrl: assignment.resourceUrl,
        due: assignment.due,
        start,
        end: sessionEnd,
        label: buildAssignmentReason(assignment)
      });

      addUsedWindow(usedWindowsByDate, dateString, start, sessionEnd);
      dailyStudyLoad[dateString] += sessionEnd - start;
      workSinceBreak[dateString] += sessionEnd - start;
      remainingHours -= sessionEnd - start;
      remainingHours = Number(remainingHours.toFixed(2));

      if(workSinceBreak[dateString] >= workLimit && remainingHours > 0){
        const breakStart = sessionEnd;
        const breakEnd = snapHour(breakStart + breakHours);

        if(breakEnd <= windowEnd){
          sessionsByDate[dateString].push({
            id: `break-${dateString}-${breakStart}`,
            kind: "break",
            title: "Break",
            className: "Break",
            type: "Break",
            priority: "Break",
            due: null,
            start: breakStart,
            end: breakEnd,
            label: `${settings.breakMinutes} min break`
          });

          addUsedWindow(usedWindowsByDate, dateString, breakStart, breakEnd);
          workSinceBreak[dateString] = 0;
        }
      }
    }

    if(remainingHours > 0.01){
      unscheduledAssignments.push({
        ...assignment,
        unscheduledHours: Number(remainingHours.toFixed(2))
      });
    }
  });

  Object.keys(sessionsByDate).forEach(dateString => {
    sessionsByDate[dateString].sort((a, b) => a.start - b.start);
    sessionsByDate[dateString] = mergeAdjacentStudySessions(sessionsByDate[dateString]);
  });

  const totalScheduledHours = Object.values(sessionsByDate)
    .flat()
    .filter(session => session.kind === "study")
    .reduce((sum, session) => sum + (session.end - session.start), 0);

  return {
    sessionsByDate,
    unscheduledAssignments,
    totalScheduledHours: Number(totalScheduledHours.toFixed(2)),
    remainingWorkHours: Number(calculateTotalWorkload().toFixed(2))
  };
}

function mergeAdjacentStudySessions(sessions){
  const merged = [];

  sessions.forEach(session => {
    const previous = merged[merged.length - 1];

    if(
      previous &&
      previous.kind === "study" &&
      session.kind === "study" &&
      previous.assignmentId === session.assignmentId &&
      Math.abs(previous.end - session.start) <= (1 / 60)
    ){
      previous.end = session.end;
      return;
    }

    merged.push({ ...session });
  });

  return merged;
}

function calculateFreeHoursToday(){
  return Number(
    getStudyWindowsForDate(getNow())
      .reduce((sum, window) => sum + (window.end - window.start), 0)
      .toFixed(2)
  );
}

function getPlannerStatus(planResult){
  const unscheduledHours = planResult.unscheduledAssignments
    .reduce((sum, item) => sum + item.unscheduledHours, 0);

  if(planResult.unscheduledAssignments.length > 0){
    return {
      level: "Needs Attention",
      color: "#fca5a5",
      message: `${planResult.unscheduledAssignments.length} assignment(s) still need ${formatHoursValue(unscheduledHours)} of open time.`
    };
  }

  if(isRecoveryModeEnabled()){
    return {
      level: "Recovery Mode",
      color: "#fbbf24",
      message: "The planner is front-loading work and stretching past your preferred daily limit to help you catch up."
    };
  }

  const urgentCount = assignments.filter(item =>
    !item.completed &&
    getDaysUntil(item.due) <= 2
  ).length;

  if(urgentCount >= 2){
    return {
      level: "Focused",
      color: "#fbbf24",
      message: "You are on track, but several assignments are due soon."
    };
  }

  return {
    level: "On Track",
    color: "#34d399",
    message: "Your work fits into the available study windows right now."
  };
}

function getCurrentPlannedSession(planResult){
  const now = getNow();
  const todayString = formatDateLocal(now);
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const sessions = planResult.sessionsByDate[todayString] || [];

  return sessions.find(session =>
    currentHour >= session.start &&
    currentHour < session.end
  ) || null;
}

function getUpcomingSessions(planResult, limit = 3){
  const now = getNow();
  const todayString = formatDateLocal(now);
  const currentHour = now.getHours() + now.getMinutes() / 60;

  return Object.entries(planResult.sessionsByDate)
    .flatMap(([dateString, sessions]) =>
      sessions
        .filter(session => session.kind === "study")
        .map(session => ({
          ...session,
          dateString
        }))
    )
    .filter(session =>
      session.dateString > todayString ||
      (
        session.dateString === todayString &&
        session.end > currentHour
      )
    )
    .sort((a, b) => {
      if(a.dateString !== b.dateString){
        return a.dateString.localeCompare(b.dateString);
      }

      return a.start - b.start;
    })
    .slice(0, limit);
}

function getBestTask(planResult){
  const upcoming = getUpcomingSessions(planResult, 1)[0];

  if(upcoming){
    return {
      title: upcoming.title,
      subtitle: `${upcoming.className} · ${upcoming.type}`,
      reason: `${upcoming.dateString} · ${decimalHourToTime(upcoming.start)} - ${decimalHourToTime(upcoming.end)}`,
      resourceUrl: upcoming.resourceUrl
    };
  }

  const priorityAssignment = getPriorityAssignments()[0];

  if(!priorityAssignment){
    return null;
  }

  return {
    title: priorityAssignment.title,
    subtitle: `${priorityAssignment.className} · ${priorityAssignment.type}`,
    reason: buildAssignmentReason(priorityAssignment),
    resourceUrl: priorityAssignment.resourceUrl
  };
}

function renderAIInsights(){
  const sidebar = document.querySelector(".sidebar");

  if(!sidebar){
    return;
  }

  let panel = document.getElementById("aiInsights");

  if(!panel){
    panel = document.createElement("div");
    panel.id = "aiInsights";
    panel.className = "card";
    sidebar.prepend(panel);
  }

  const planResult = getActiveSmartStudyPlan();
  const current = getCurrentPlannedSession(planResult);
  const bestTask = getBestTask(planResult);
  const status = getPlannerStatus(planResult);
  const freeTime = calculateFreeHoursToday();
  const workload = calculateTotalWorkload();
  const upcomingSessions = getUpcomingSessions(planResult, 3);
  const lockedPlanCopy = getActiveSmartStudyPlan();
  const lockedPlanMessage = `Study blocks stay fixed until you press Regenerate Schedule. Last generated ${formatLockedPlanTimestamp(lockedPlanCopy.generatedAt)}.`;

  panel.innerHTML = `
    <div class="section-title">AI Planner</div>

    <div class="current-assignment-box">
      <div class="kicker">CURRENT BLOCK</div>
      <div class="hero-value">
        ${
          current
            ? current.kind === "break"
              ? "Take a Break"
              : escapeHTML(current.title)
            : "No active work block"
        }
      </div>
      <div class="muted-copy">
        ${
          current
            ? current.kind === "break"
              ? escapeHTML(current.label)
              : `${escapeHTML(current.className)} · ${decimalHourToTime(current.start)} - ${decimalHourToTime(current.end)}`
            : "The planner will surface your next scheduled block here."
        }
      </div>
      <div class="link-row">
        ${
          current && current.kind !== "break"
            ? getAssignmentLinkStatusHTML(current.resourceUrl, {
              linkLabel: "Open Assignment",
              emptyLabel: "No link attached"
            })
            : ""
        }
      </div>
    </div>

    <div class="insight-block">
      <div class="kicker">PLAN LOCK</div>
      <div class="muted-copy">${escapeHTML(lockedPlanMessage)}</div>
      ${
        lockedStudyPlanDirty
          ? `<div class="plan-lock-warning">Assignments, busy times, or settings changed. Press Regenerate Schedule to refresh the plan.</div>`
          : ""
      }
    </div>

    <div class="mini-stat-grid">
      <div class="mini-stat">
        <div class="kicker">FREE TODAY</div>
        <div class="hero-value">${formatHoursValue(freeTime)}</div>
      </div>

      <div class="mini-stat">
        <div class="kicker">WORKLOAD</div>
        <div class="hero-value">${formatHoursValue(workload)}</div>
      </div>
    </div>

    <div class="insight-block">
      <div class="kicker">PLANNER STATUS</div>
      <div class="hero-value" style="color:${status.color};">${status.level}</div>
      <div class="muted-copy">${escapeHTML(status.message)}</div>
    </div>

    <div class="insight-block">
      <div class="kicker">RECOMMENDED NEXT TASK</div>
      <div class="hero-value">${bestTask ? escapeHTML(bestTask.title) : "You are caught up"}</div>
      <div class="muted-copy">
        ${bestTask ? `${escapeHTML(bestTask.subtitle)} · ${escapeHTML(bestTask.reason)}` : "No unfinished assignments are waiting right now."}
      </div>
      <div class="link-row">
        ${
          bestTask
            ? getAssignmentLinkStatusHTML(bestTask.resourceUrl, {
              linkLabel: "Open Assignment",
              emptyLabel: "No link attached"
            })
            : ""
        }
      </div>
    </div>

    <div class="insight-block">
      <div class="kicker">UPCOMING STUDY BLOCKS</div>
      ${
        upcomingSessions.length === 0
          ? `<div class="muted-copy">No study blocks are scheduled yet. Add work or extend your availability.</div>`
          : `
            <div class="insight-list">
              ${upcomingSessions.map(session => `
                <div class="insight-row">
                  <div>
                    <div class="row-title">${escapeHTML(session.title)}</div>
                    <div class="row-sub">${escapeHTML(session.className)} · ${escapeHTML(session.dateString)}</div>
                  </div>
                  <div class="row-side">${decimalHourToTime(session.start)}</div>
                </div>
              `).join("")}
            </div>
          `
      }
    </div>

    ${
      planResult.unscheduledAssignments.length === 0
        ? ""
        : `
          <div class="warning-panel">
            <div class="kicker">AT RISK</div>
            <div class="warning-list">
              ${planResult.unscheduledAssignments.map(item => `
                <div class="warning-row">
                  <strong>${escapeHTML(item.title)}</strong>
                  <span>${escapeHTML(item.due)} · ${formatHoursValue(item.unscheduledHours)} unscheduled</span>
                </div>
              `).join("")}
            </div>
          </div>
        `
    }
  `;
}

function initializeAI(){
  renderAIInsights();
}
