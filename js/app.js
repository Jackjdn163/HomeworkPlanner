function refreshClassOptions(){
  const classSelect = document.getElementById("class");

  if(!classSelect){
    return;
  }

  const previousValue = classSelect.value;
  const options = getClassOptions();

  classSelect.innerHTML = options.map(option => `
    <option value="${escapeHTML(option)}">${escapeHTML(option)}</option>
  `).join("");

  if(options.includes(previousValue)){
    classSelect.value = previousValue;
  }
}

function populateSetupForm(){
  const anchorInput = document.getElementById("anchorADay");

  if(anchorInput){
    anchorInput.value = schedule.anchorADay || getTodayDateString();
  }

  ["A", "B"].forEach(dayKey => {
    getClassEntriesForDay(dayKey).forEach((entry, index) => {
      const input = document.getElementById(`${dayKey.toLowerCase()}${index + 1}`);

      if(input){
        input.value = entry.name;
      }
    });
  });
}

function populatePlannerSettings(){
  const settings = getPlannerSettings();
  const breakInput = document.getElementById("breakMinutes");
  const workInput = document.getElementById("workMinutesBeforeBreak");
  const latestStudyEndInput = document.getElementById("latestStudyEnd");

  if(breakInput){
    breakInput.value = settings.breakMinutes;
  }

  if(workInput){
    workInput.value = settings.workMinutesBeforeBreak;
  }

  if(latestStudyEndInput){
    latestStudyEndInput.value = settings.latestStudyEnd;
  }

  if(typeof renderPlannerSettingsHint === "function"){
    renderPlannerSettingsHint();
  }
}

function populateDevTimeSettings(){
  clearDevTimeSettings();
}

function setDevTimeInputsDisabled(disabled){
  return disabled;
}

function renderDevTimePreview(){
  return;
}

function syncDevTimeSlider(){
  return;
}

function syncDevTimeInput(){
  return;
}

function toggleDevTimeTesting(){
  clearDevTimeSettings();
}

function saveDevTimeControls(){
  clearDevTimeSettings();
}

function resetDevTimeControls(){
  clearDevTimeSettings();
}

function setDefaultDates(force = false){
  const today = getTodayDateString();
  const assignedInput = document.getElementById("assigned");
  const dueInput = document.getElementById("due");
  const busyDateInput = document.getElementById("busyDate");

  if(assignedInput && (force || !assignedInput.value)){
    assignedInput.value = today;
  }

  if(dueInput && (force || !dueInput.value)){
    dueInput.value = today;
  }

  if(busyDateInput && (force || !busyDateInput.value)){
    busyDateInput.value = today;
  }
}

function openSettingsDrawer(){
  const drawer = document.getElementById("settingsDrawer");

  if(!drawer){
    return;
  }

  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
  populatePlannerSettings();

  if(typeof renderPlannerPlusPanels === "function"){
    renderPlannerPlusPanels();
  }
}

function closeSettingsDrawer(){
  const drawer = document.getElementById("settingsDrawer");

  if(!drawer){
    return;
  }

  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
}

function openQuickAdd(mode = "assignment"){
  if(isReadOnlySharedView()){
    return;
  }

  const modal = document.getElementById("quickAddModal");
  const assignmentPane = document.getElementById("assignmentComposer");
  const busyPane = document.getElementById("busyComposer");
  const smartPane = document.getElementById("smartComposer");
  const assignmentTab = document.getElementById("tabAssignment");
  const busyTab = document.getElementById("tabBusy");
  const smartTab = document.getElementById("tabSmart");
  const menu = document.getElementById("floatingAddMenu");

  if(modal){
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  if(menu){
    menu.classList.add("hidden");
  }

  const showAssignment = mode === "assignment";
  const showBusy = mode === "busy";
  const showSmart = mode === "smart";

  if(assignmentPane){
    assignmentPane.classList.toggle("hidden", !showAssignment);
  }

  if(busyPane){
    busyPane.classList.toggle("hidden", !showBusy);
  }

  if(smartPane){
    smartPane.classList.toggle("hidden", !showSmart);
  }

  if(assignmentTab){
    assignmentTab.classList.toggle("active", showAssignment);
  }

  if(busyTab){
    busyTab.classList.toggle("active", showBusy);
  }

  if(smartTab){
    smartTab.classList.toggle("active", showSmart);
  }
}

function closeQuickAdd(){
  const modal = document.getElementById("quickAddModal");
  const menu = document.getElementById("floatingAddMenu");

  if(modal){
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  if(menu){
    menu.classList.add("hidden");
  }
}

function toggleQuickAddMenu(){
  const menu = document.getElementById("floatingAddMenu");

  if(!menu){
    return;
  }

  menu.classList.toggle("hidden");
}

function initializeSurfaceControls(){
  document.addEventListener("keydown", event => {
    if(event.key === "Escape"){
      closeQuickAdd();
      closeSettingsDrawer();
    }
  });

  document.addEventListener("click", event => {
    const menu = document.getElementById("floatingAddMenu");
    const button = document.getElementById("floatingAddButton");

    if(
      menu &&
      button &&
      !menu.classList.contains("hidden") &&
      !menu.contains(event.target) &&
      !button.contains(event.target)
    ){
      menu.classList.add("hidden");
    }
  });
}

function renderTodayText(){
  const todayText = document.getElementById("todayText");

  if(!todayText){
    return;
  }

  const now = getNow();
  const rotation = getABDay(now);

  todayText.innerHTML = `
    <div>${now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    })}</div>
    <div style="font-size:0.82rem; opacity:0.72; margin-top:3px;">
      ${rotation === "Weekend" ? "Weekend" : `${rotation} Day`}
    </div>
  `;
}

function showSetupIfNeeded(){
  const setup = document.getElementById("setup");

  if(!setup){
    return;
  }

  if(!scheduleWasSaved){
    setup.classList.remove("hidden");
  }
}

function saveSchedule(){
  if(isReadOnlySharedView()){
    return;
  }

  const anchorInput = document.getElementById("anchorADay");
  const anchorADay = anchorInput?.value || getTodayDateString();

  schedule = {
    anchorADay,
    A: PERIOD_SLOTS.map((slot, index) => ({
      slotId: slot.id,
      name: document.getElementById(`a${index + 1}`)?.value.trim() || ""
    })),
    B: PERIOD_SLOTS.map((slot, index) => ({
      slotId: slot.id,
      name: document.getElementById(`b${index + 1}`)?.value.trim() || ""
    }))
  };

  saveScheduleData();
  refreshClassOptions();

  const setup = document.getElementById("setup");

  if(setup){
    setup.classList.add("hidden");
  }

  renderTodayText();
  renderAll();
}

function resetScheduleSetup(){
  if(isReadOnlySharedView()){
    return;
  }

  localStorage.removeItem("schedule");
  schedule = getDefaultSchedule();
  scheduleWasSaved = false;

  if(typeof markSmartPlanDirty === "function"){
    markSmartPlanDirty();
  }

  populateSetupForm();
  refreshClassOptions();
  renderTodayText();
  renderAll();

  const setup = document.getElementById("setup");

  if(setup){
    setup.classList.remove("hidden");
  }
}

function initializeApp(){
  if(typeof hydrateSharedViewIfPresent === "function"){
    hydrateSharedViewIfPresent();
  }

  if(typeof initializePlannerPlus === "function"){
    initializePlannerPlus();
  }

  if(typeof hadLegacyDevTimeOverride !== "undefined" && hadLegacyDevTimeOverride){
    clearDevTimeSettings();

    if(typeof clearLockedStudyPlan === "function"){
      clearLockedStudyPlan();
    }
  }

  populateSetupForm();
  refreshClassOptions();
  setDefaultDates();
  populatePlannerSettings();

  if(typeof ensureRecurringTemplateAssignments === "function"){
    ensureRecurringTemplateAssignments();
  }

  renderTodayText();
  showSetupIfNeeded();
  initializeAI();
  initializeSurfaceControls();
  renderAll();

  if(typeof initializeCloudSync === "function"){
    void initializeCloudSync();
  }

  setInterval(() => {
    renderTodayText();
    renderWeek();
    renderAIInsights();

    if(typeof runPlannerNotificationsCheck === "function"){
      runPlannerNotificationsCheck();
    }
  }, 60000);
}

initializeApp();
