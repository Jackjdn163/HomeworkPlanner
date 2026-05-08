const CLASS_PROFILES_STORAGE_KEY = "classProfiles";
const HOMEWORK_TEMPLATES_STORAGE_KEY = "homeworkTemplates";
const WHAT_IF_SCENARIO_STORAGE_KEY = "whatIfScenario";
const STUDY_HISTORY_STORAGE_KEY = "studyHistory";
const NOTIFICATION_SETTINGS_STORAGE_KEY = "plannerNotificationSettings";
const PLANNER_PLUS_SETTINGS_STORAGE_KEY = "plannerPlusSettings";
const FOCUS_TIMER_STORAGE_KEY = "plannerFocusTimer";
const SHARED_SNAPSHOT_HASH_KEY = "#plannerShare=";

const DEFAULT_CLASS_COLORS = [
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6"
];

const DEFAULT_PLANNER_PLUS_SETTINGS = {
  preferredDailyWorkLimitMinutes: 180,
  energyProfile: "Balanced",
  recoveryMode: false
};

const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: false,
  leadMinutes: 10
};

let classProfiles = normalizeClassProfiles(loadJSON(CLASS_PROFILES_STORAGE_KEY, {}));
let homeworkTemplates = normalizeHomeworkTemplates(loadJSON(HOMEWORK_TEMPLATES_STORAGE_KEY, []));
let whatIfScenario = normalizeWhatIfScenario(loadJSON(WHAT_IF_SCENARIO_STORAGE_KEY, null));
let studyHistory = normalizeStudyHistory(loadJSON(STUDY_HISTORY_STORAGE_KEY, []));
let plannerPlusSettings = normalizePlannerPlusSettings(loadJSON(PLANNER_PLUS_SETTINGS_STORAGE_KEY, null));
let notificationSettings = normalizeNotificationSettings(loadJSON(NOTIFICATION_SETTINGS_STORAGE_KEY, null));
let focusTimerState = normalizeFocusTimerState(loadJSON(FOCUS_TIMER_STORAGE_KEY, null));
let pendingAttachmentFiles = [];
let sharedViewState = {
  enabled: false,
  hydrated: false,
  sourceSnapshot: null
};
let deferredInstallPrompt = null;
let notificationLog = loadJSON("plannerNotificationLog", {});
let focusTimerInterval = null;

function createLocalId(prefix = "item"){
  if(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"){
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function stableColorFromName(name){
  const safeName = String(name || "").trim();

  if(!safeName){
    return DEFAULT_CLASS_COLORS[0];
  }

  let hash = 0;

  for(let index = 0; index < safeName.length; index += 1){
    hash = ((hash << 5) - hash) + safeName.charCodeAt(index);
    hash |= 0;
  }

  return DEFAULT_CLASS_COLORS[Math.abs(hash) % DEFAULT_CLASS_COLORS.length];
}

function hexToRgba(hex, alpha = 1){
  const normalized = String(hex || "").replace("#", "").trim();

  if(!/^[a-fA-F0-9]{6}$/.test(normalized)){
    return `rgba(59, 130, 246, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function normalizeClassProfiles(rawProfiles){
  const safeProfiles = rawProfiles && typeof rawProfiles === "object"
    ? rawProfiles
    : {};
  const normalized = {};

  Object.entries(safeProfiles).forEach(([className, profile]) => {
    const safeName = String(className || "").trim();

    if(!safeName){
      return;
    }

    normalized[safeName] = {
      teacherName: String(profile?.teacherName || "").trim(),
      portalUrl: normalizeAssignmentUrl(profile?.portalUrl || ""),
      color: /^#[a-fA-F0-9]{6}$/.test(String(profile?.color || ""))
        ? String(profile.color)
        : stableColorFromName(safeName)
    };
  });

  return normalized;
}

function normalizeHomeworkTemplates(items){
  if(!Array.isArray(items)){
    return [];
  }

  return items.map((item, index) => ({
    id: String(item?.id || createLocalId(`template-${index}`)),
    title: String(item?.title || "").trim() || `Template ${index + 1}`,
    className: String(item?.className || "General / Other").trim() || "General / Other",
    type: String(item?.type || "Homework"),
    priority: String(item?.priority || "Medium"),
    hours: Math.max(0.25, Number(item?.hours || 1)),
    repeat: String(item?.repeat || "Weekly"),
    anchorWeekday: Number.isFinite(Number(item?.anchorWeekday))
      ? Number(item.anchorWeekday)
      : getNow().getDay(),
    dueOffsetDays: Math.max(0, Number(item?.dueOffsetDays || 0)),
    resourceUrl: normalizeAssignmentUrl(item?.resourceUrl || ""),
    notes: String(item?.notes || "").trim(),
    gradeWeight: clampGradeWeight(item?.gradeWeight),
    energyLevel: normalizeEnergyLevel(item?.energyLevel),
    studyMode: normalizeStudyMode(item?.studyMode),
    subtasks: normalizeSubtasks(item?.subtasks, item),
    createdAt: item?.createdAt || new Date().toISOString()
  }));
}

function normalizeWhatIfScenario(rawScenario){
  const scenario = rawScenario && typeof rawScenario === "object"
    ? rawScenario
    : {};

  return {
    enabled: Boolean(scenario.enabled),
    blocks: Array.isArray(scenario.blocks)
      ? scenario.blocks
        .map((block, index) => normalizeWhatIfBlock(block, index))
        .filter(Boolean)
      : []
  };
}

function normalizeWhatIfBlock(block, index = 0){
  if(!block){
    return null;
  }

  const date = parseLocalDate(block.date);
  const start = timeToDecimal(block.start);
  const end = timeToDecimal(block.end, {
    midnightAs24: true,
    referenceStart: start
  });

  if(!date || start === null || end === null || end <= start){
    return null;
  }

  return {
    id: String(block.id || createLocalId(`what-if-${index}`)),
    title: String(block.title || "What-if block").trim() || "What-if block",
    date: formatDateLocal(date),
    start: block.start,
    end: block.end
  };
}

function normalizeStudyHistory(items){
  if(!Array.isArray(items)){
    return [];
  }

  return items
    .map((item, index) => ({
      id: String(item?.id || createLocalId(`history-${index}`)),
      date: item?.date || getTodayDateString(),
      assignmentId: item?.assignmentId ?? null,
      title: String(item?.title || "").trim(),
      className: String(item?.className || "General / Other").trim() || "General / Other",
      minutes: Math.max(1, Math.round(Number(item?.minutes || 0) || 0)),
      source: String(item?.source || "focus-timer"),
      createdAt: item?.createdAt || new Date().toISOString()
    }))
    .filter(item => item.minutes > 0);
}

function normalizePlannerPlusSettings(rawSettings){
  const safeSettings = rawSettings && typeof rawSettings === "object"
    ? rawSettings
    : {};
  const preferredDailyLimitValue = Number(
    safeSettings.preferredDailyWorkLimitMinutes ?? safeSettings.dailyWorkCapMinutes
  );

  return {
    preferredDailyWorkLimitMinutes: Math.max(
      30,
      Math.round(
        Number.isFinite(preferredDailyLimitValue) && preferredDailyLimitValue > 0
          ? preferredDailyLimitValue
          : DEFAULT_PLANNER_PLUS_SETTINGS.preferredDailyWorkLimitMinutes
      )
    ),
    energyProfile: normalizeEnergyProfile(safeSettings.energyProfile),
    recoveryMode: Boolean(safeSettings.recoveryMode)
  };
}

function normalizeNotificationSettings(rawSettings){
  const safeSettings = rawSettings && typeof rawSettings === "object"
    ? rawSettings
    : {};

  return {
    enabled: Boolean(safeSettings.enabled),
    leadMinutes: Math.max(1, Math.round(Number(safeSettings.leadMinutes || DEFAULT_NOTIFICATION_SETTINGS.leadMinutes)))
  };
}

function normalizeFocusTimerState(rawState){
  const safeState = rawState && typeof rawState === "object"
    ? rawState
    : {};

  return {
    running: Boolean(safeState.running),
    startedAt: Number(safeState.startedAt || 0),
    elapsedSeconds: Math.max(0, Math.round(Number(safeState.elapsedSeconds || 0))),
    assignmentId: safeState.assignmentId ?? null,
    sessionId: safeState.sessionId || "",
    sessionDate: safeState.sessionDate || "",
    sessionStart: Number.isFinite(Number(safeState.sessionStart)) ? Number(safeState.sessionStart) : null,
    sessionEnd: Number.isFinite(Number(safeState.sessionEnd)) ? Number(safeState.sessionEnd) : null,
    title: String(safeState.title || "").trim(),
    className: String(safeState.className || "").trim()
  };
}

function normalizeEnergyLevel(value){
  const safeValue = String(value || "Medium");

  if(["Low", "Medium", "High"].includes(safeValue)){
    return safeValue;
  }

  return "Medium";
}

function normalizeStudyMode(value){
  const safeValue = String(value || "Normal");

  if(["Normal", "Test Prep", "Deep Work", "Quick Review"].includes(safeValue)){
    return safeValue;
  }

  return "Normal";
}

function normalizeEnergyProfile(value){
  const safeValue = String(value || "Balanced");

  if(["Balanced", "Afternoon Focus", "Evening Focus", "Lunch Sprinter"].includes(safeValue)){
    return safeValue;
  }

  return "Balanced";
}

function clampGradeWeight(value){
  const weight = Number(value || 0);

  if(!Number.isFinite(weight) || weight <= 0){
    return 0;
  }

  return Math.min(100, Math.round(weight));
}

function normalizeSubtasks(items, assignmentLike = {}){
  if(Array.isArray(items) && items.length > 0){
    return items
      .map((item, index) => ({
        id: String(item?.id || createLocalId(`subtask-${index}`)),
        text: String(item?.text || item?.title || "").trim(),
        completed: Boolean(item?.completed)
      }))
      .filter(item => item.text);
  }

  return buildDefaultSubtasks(assignmentLike);
}

function normalizeAttachments(items){
  if(!Array.isArray(items)){
    return [];
  }

  return items
    .map((item, index) => ({
      id: String(item?.id || createLocalId(`attachment-${index}`)),
      name: String(item?.name || `Attachment ${index + 1}`).trim(),
      dataUrl: typeof item?.dataUrl === "string" ? item.dataUrl : "",
      url: normalizeAssignmentUrl(item?.url || ""),
      mimeType: String(item?.mimeType || "").trim()
    }))
    .filter(item => item.name && (item.dataUrl || item.url));
}

function buildDefaultSubtasks(assignmentLike = {}){
  const type = String(assignmentLike.type || "Homework");
  const hours = Math.max(0.25, Number(assignmentLike.hours || 1));
  const title = String(assignmentLike.title || "").trim() || "assignment";
  let labels = [];

  if(type === "Essay"){
    labels = ["Read the prompt", "Create an outline", "Write the first draft", "Revise and proofread"];
  }else if(type === "Project"){
    labels = ["Check requirements", "Research materials", "Build the main draft", "Review and finalize"];
  }else if(type === "Test" || type === "Quiz" || String(assignmentLike.studyMode || "") === "Test Prep"){
    labels = ["Review notes", "Practice problems", "Self-check weak spots", "Quick final recap"];
  }else if(hours >= 2){
    labels = ["Understand the directions", "Complete the first pass", "Finish remaining work", "Review before submitting"];
  }

  return labels.map((label, index) => ({
    id: createLocalId(`subtask-${index}`),
    text: `${label}${title ? ` for ${title}` : ""}`,
    completed: false
  }));
}

function parseSubtasksText(value, fallbackAssignment = {}){
  const lines = String(value || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  if(lines.length === 0){
    return buildDefaultSubtasks(fallbackAssignment);
  }

  return lines.map((line, index) => ({
    id: createLocalId(`subtask-line-${index}`),
    text: line,
    completed: false
  }));
}

function getPlannerPlusSettings(){
  return {
    ...plannerPlusSettings
  };
}

function getPlannerPlusSettingsSnapshot(){
  return {
    ...plannerPlusSettings,
    notificationSettings,
    classProfiles,
    homeworkTemplates,
    whatIfScenario,
    studyHistory
  };
}

function applyPlannerPlusSettingsSnapshot(snapshot = {}, options = {}){
  plannerPlusSettings = normalizePlannerPlusSettings(snapshot);
  notificationSettings = normalizeNotificationSettings(snapshot.notificationSettings);
  classProfiles = normalizeClassProfiles(snapshot.classProfiles);
  homeworkTemplates = normalizeHomeworkTemplates(snapshot.homeworkTemplates);
  whatIfScenario = normalizeWhatIfScenario(snapshot.whatIfScenario);
  studyHistory = normalizeStudyHistory(snapshot.studyHistory);

  if(options.persist !== false){
    saveJSON(PLANNER_PLUS_SETTINGS_STORAGE_KEY, plannerPlusSettings);
    saveJSON(NOTIFICATION_SETTINGS_STORAGE_KEY, notificationSettings);
    saveJSON(CLASS_PROFILES_STORAGE_KEY, classProfiles);
    saveJSON(HOMEWORK_TEMPLATES_STORAGE_KEY, homeworkTemplates);
    saveJSON(WHAT_IF_SCENARIO_STORAGE_KEY, whatIfScenario);
    saveJSON(STUDY_HISTORY_STORAGE_KEY, studyHistory);
  }
}

function persistPlannerPlusSettings(reason = "planner extras"){
  saveJSON(PLANNER_PLUS_SETTINGS_STORAGE_KEY, plannerPlusSettings);
  saveJSON(NOTIFICATION_SETTINGS_STORAGE_KEY, notificationSettings);
  saveJSON(CLASS_PROFILES_STORAGE_KEY, classProfiles);
  saveJSON(HOMEWORK_TEMPLATES_STORAGE_KEY, homeworkTemplates);
  saveJSON(WHAT_IF_SCENARIO_STORAGE_KEY, whatIfScenario);
  saveJSON(STUDY_HISTORY_STORAGE_KEY, studyHistory);
  saveJSON(FOCUS_TIMER_STORAGE_KEY, focusTimerState);

  if(typeof markSmartPlanDirty === "function"){
    markSmartPlanDirty();
  }

  if(typeof queueCloudSync === "function"){
    queueCloudSync(reason);
  }
}

function getAllKnownClassNames(){
  const names = new Set(Object.keys(classProfiles));

  ["A", "B"].forEach(dayKey => {
    getClassEntriesForDay(dayKey).forEach(entry => {
      if(entry.name){
        names.add(entry.name);
      }
    });
  });

  if(Array.isArray(assignments)){
    assignments.forEach(item => {
      if(item.className){
        names.add(item.className);
      }
    });
  }

  names.add("General / Other");
  return [...names].sort((a, b) => a.localeCompare(b));
}

function getClassProfile(className){
  const safeName = String(className || "General / Other").trim() || "General / Other";

  if(!classProfiles[safeName]){
    classProfiles[safeName] = {
      teacherName: "",
      portalUrl: "",
      color: stableColorFromName(safeName)
    };
  }

  return classProfiles[safeName];
}

function getClassAccent(className){
  return getClassProfile(className).color || stableColorFromName(className);
}

function getClassPortalUrl(className){
  return getClassProfile(className).portalUrl || "";
}

function createClassPortalLinkHTML(className, label = "Class Portal", classNameValue = "inline-link-button"){
  return createAssignmentLinkHTML(
    getClassPortalUrl(className),
    label,
    classNameValue
  );
}

function getClassPortalStatusHTML(className, label = "Class Portal"){
  return getAssignmentLinkStatusHTML(getClassPortalUrl(className), {
    linkLabel: label,
    emptyLabel: "No class portal",
    emptyClassName: "empty-link-pill"
  });
}

function getEventAccentStyle(className, kind = "study"){
  const color = getClassAccent(className);

  if(kind === "class"){
    return `
      border-color:${hexToRgba(color, 0.45)};
      background:linear-gradient(135deg, ${hexToRgba(color, 0.96)}, ${hexToRgba(color, 0.78)});
      box-shadow:0 8px 20px ${hexToRgba(color, 0.24)};
    `;
  }

  if(kind === "study"){
    return `
      border-color:${hexToRgba(color, 0.28)};
      background:linear-gradient(135deg, ${hexToRgba(color, 0.98)}, rgba(30, 41, 59, 0.96));
      box-shadow:0 12px 28px ${hexToRgba(color, 0.32)}, 0 5px 18px rgba(0,0,0,0.34);
    `;
  }

  if(kind === "due"){
    return `
      border-color:${hexToRgba(color, 0.2)};
      background:linear-gradient(135deg, ${hexToRgba(color, 0.82)}, rgba(15,23,42,0.88));
    `;
  }

  return "";
}

function getAssignmentAttachmentLinksHTML(attachments){
  const safeAttachments = normalizeAttachments(attachments);

  if(safeAttachments.length === 0){
    return "";
  }

  return `
    <div class="attachment-pill-row">
      ${safeAttachments.map(item => `
        <a
          class="attachment-pill"
          href="${escapeHTML(item.dataUrl || item.url)}"
          target="_blank"
          rel="noreferrer noopener"
        >
          ${escapeHTML(item.name)}
        </a>
      `).join("")}
    </div>
  `;
}

function getAssignmentChecklistHTML(assignment, interactive = true){
  const subtasks = normalizeSubtasks(assignment.subtasks, assignment);

  if(subtasks.length === 0){
    return "";
  }

  return `
    <div class="subtask-list">
      ${subtasks.map(item => `
        <label class="subtask-row ${item.completed ? "subtask-complete" : ""}">
          <input
            type="checkbox"
            ${item.completed ? "checked" : ""}
            ${interactive ? "" : "disabled"}
            onchange="${interactive ? `toggleSubtaskComplete(${assignment.id}, '${escapeHTML(item.id)}')` : ""}"
          />
          <span>${escapeHTML(item.text)}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function getNextOpenSubtask(assignment){
  return normalizeSubtasks(assignment.subtasks, assignment).find(item => !item.completed) || null;
}

function toggleSubtaskComplete(assignmentId, subtaskId){
  if(isReadOnlySharedView()){
    return;
  }

  assignments = assignments.map(assignment => {
    if(assignment.id !== assignmentId){
      return assignment;
    }

    const nextSubtasks = normalizeSubtasks(assignment.subtasks, assignment).map(item => {
      if(item.id === subtaskId){
        return {
          ...item,
          completed: !item.completed
        };
      }

      return item;
    });

    return {
      ...assignment,
      subtasks: nextSubtasks
    };
  });

  saveAssignments();
  renderAll();
}

function updateClassProfilesFromUI(){
  const rows = document.querySelectorAll("[data-class-profile-row]");
  const nextProfiles = {};

  rows.forEach(row => {
    const className = row.getAttribute("data-class-name") || "";

    if(!className){
      return;
    }

    nextProfiles[className] = {
      teacherName: row.querySelector("[data-class-profile-field='teacherName']")?.value.trim() || "",
      portalUrl: normalizeAssignmentUrl(row.querySelector("[data-class-profile-field='portalUrl']")?.value || ""),
      color: row.querySelector("[data-class-profile-field='color']")?.value || stableColorFromName(className)
    };
  });

  classProfiles = normalizeClassProfiles(nextProfiles);
  persistPlannerPlusSettings("class profiles");
  renderPlannerPlusPanels();
  renderAll();
}

function saveAdvancedPlannerSettings(){
  if(isReadOnlySharedView()){
    return;
  }

  plannerPlusSettings = normalizePlannerPlusSettings({
    preferredDailyWorkLimitMinutes: Number(
      document.getElementById("preferredDailyWorkLimitMinutes")?.value ||
      DEFAULT_PLANNER_PLUS_SETTINGS.preferredDailyWorkLimitMinutes
    ),
    energyProfile: document.getElementById("energyProfile")?.value || DEFAULT_PLANNER_PLUS_SETTINGS.energyProfile,
    recoveryMode: Boolean(document.getElementById("recoveryMode")?.checked)
  });

  persistPlannerPlusSettings("advanced settings");
  renderAll();
}

function saveNotificationPreferences(){
  if(isReadOnlySharedView()){
    return;
  }

  notificationSettings = normalizeNotificationSettings({
    enabled: Boolean(document.getElementById("notificationsEnabled")?.checked),
    leadMinutes: Number(document.getElementById("notificationLeadMinutes")?.value || DEFAULT_NOTIFICATION_SETTINGS.leadMinutes)
  });

  persistPlannerPlusSettings("notification settings");
  renderPlannerPlusPanels();
}

function addWhatIfBlock(){
  if(isReadOnlySharedView()){
    return;
  }

  const titleInput = document.getElementById("whatIfTitle");
  const dateInput = document.getElementById("whatIfDate");
  const startInput = document.getElementById("whatIfStart");
  const endInput = document.getElementById("whatIfEnd");

  const block = normalizeWhatIfBlock({
    id: createLocalId("what-if"),
    title: titleInput?.value || "What-if block",
    date: dateInput?.value,
    start: startInput?.value,
    end: endInput?.value
  });

  if(!block){
    alert("Please add a valid temporary what-if block.");
    return;
  }

  whatIfScenario.blocks.push(block);
  whatIfScenario.enabled = true;
  persistPlannerPlusSettings("what-if scenario");

  if(titleInput){
    titleInput.value = "";
  }

  if(startInput){
    startInput.value = "";
  }

  if(endInput){
    endInput.value = "";
  }

  renderPlannerPlusPanels();
  renderAll();
}

function deleteWhatIfBlock(blockId){
  if(isReadOnlySharedView()){
    return;
  }

  whatIfScenario.blocks = whatIfScenario.blocks.filter(block => block.id !== blockId);
  persistPlannerPlusSettings("what-if scenario");
  renderPlannerPlusPanels();
  renderAll();
}

function toggleWhatIfScenarioEnabled(){
  if(isReadOnlySharedView()){
    return;
  }

  whatIfScenario.enabled = Boolean(document.getElementById("whatIfEnabled")?.checked);
  persistPlannerPlusSettings("what-if scenario");
  renderAll();
}

function getWhatIfBlocksForDate(date){
  if(!whatIfScenario.enabled){
    return [];
  }

  const dateString = formatDateLocal(date);

  return whatIfScenario.blocks.filter(block => block.date === dateString);
}

function toggleTemplateFields(){
  const fields = document.getElementById("templateFields");
  const checked = Boolean(document.getElementById("saveAsTemplate")?.checked);

  if(fields){
    fields.classList.toggle("hidden", !checked);
  }
}

function getTemplateDraftFromForm(){
  const assignedDate = parseLocalDate(document.getElementById("assigned")?.value || getTodayDateString()) || getNow();

  return {
    title: document.getElementById("title")?.value.trim() || "",
    className: document.getElementById("class")?.value || "General / Other",
    type: document.getElementById("type")?.value || "Homework",
    priority: document.getElementById("priority")?.value || "Medium",
    hours: Math.max(0.25, Number(document.getElementById("hours")?.value || 1)),
    repeat: document.getElementById("templateRepeat")?.value || "Weekly",
    anchorWeekday: assignedDate.getDay(),
    dueOffsetDays: Math.max(0, Number(document.getElementById("templateDueOffsetDays")?.value || 0)),
    resourceUrl: normalizeAssignmentUrl(document.getElementById("resourceUrl")?.value || ""),
    notes: document.getElementById("notes")?.value.trim() || "",
    gradeWeight: clampGradeWeight(document.getElementById("gradeWeight")?.value || 0),
    energyLevel: normalizeEnergyLevel(document.getElementById("energyLevel")?.value || "Medium"),
    studyMode: normalizeStudyMode(document.getElementById("studyMode")?.value || "Normal"),
    subtasks: parseSubtasksText(
      document.getElementById("subtaskSeed")?.value || "",
      {
        title: document.getElementById("title")?.value || "",
        type: document.getElementById("type")?.value || "Homework",
        hours: document.getElementById("hours")?.value || 1,
        studyMode: document.getElementById("studyMode")?.value || "Normal"
      }
    )
  };
}

function maybeSaveRecurringTemplateFromForm(){
  if(isReadOnlySharedView()){
    return;
  }

  if(!document.getElementById("saveAsTemplate")?.checked){
    return;
  }

  const draft = getTemplateDraftFromForm();

  if(!draft.title){
    return;
  }

  homeworkTemplates.push({
    id: createLocalId("template"),
    ...draft,
    createdAt: new Date().toISOString()
  });

  homeworkTemplates = normalizeHomeworkTemplates(homeworkTemplates);
  persistPlannerPlusSettings("recurring template");
}

function resetAssignmentEnhancementFields(){
  const attachmentInput = document.getElementById("attachmentInput");
  const attachmentPreview = document.getElementById("attachmentPreview");
  const gradeWeightInput = document.getElementById("gradeWeight");
  const energyInput = document.getElementById("energyLevel");
  const studyModeInput = document.getElementById("studyMode");
  const subtaskSeedInput = document.getElementById("subtaskSeed");
  const templateCheckbox = document.getElementById("saveAsTemplate");
  const dueOffsetInput = document.getElementById("templateDueOffsetDays");
  const repeatInput = document.getElementById("templateRepeat");

  pendingAttachmentFiles = [];

  if(attachmentInput){
    attachmentInput.value = "";
  }

  if(attachmentPreview){
    attachmentPreview.innerHTML = "";
  }

  if(gradeWeightInput){
    gradeWeightInput.value = "";
  }

  if(energyInput){
    energyInput.value = "Medium";
  }

  if(studyModeInput){
    studyModeInput.value = "Normal";
  }

  if(subtaskSeedInput){
    subtaskSeedInput.value = "";
  }

  if(templateCheckbox){
    templateCheckbox.checked = false;
  }

  if(dueOffsetInput){
    dueOffsetInput.value = "0";
  }

  if(repeatInput){
    repeatInput.value = "Weekly";
  }

  toggleTemplateFields();
}

async function handleAttachmentInputChange(){
  const input = document.getElementById("attachmentInput");
  const preview = document.getElementById("attachmentPreview");
  const files = Array.from(input?.files || []);

  pendingAttachmentFiles = [];

  if(preview){
    preview.innerHTML = "";
  }

  if(files.length === 0){
    return;
  }

  const trimmedFiles = files.slice(0, 3);

  for(const file of trimmedFiles){
    if(file.size > 750000){
      alert(`${file.name} is too large to store in the planner. Please keep attachments under 750 KB each.`);
      continue;
    }

    const dataUrl = await readFileAsDataUrl(file);

    pendingAttachmentFiles.push({
      id: createLocalId("attachment"),
      name: file.name,
      mimeType: file.type || "",
      dataUrl,
      url: ""
    });
  }

  if(preview){
    preview.innerHTML = pendingAttachmentFiles.map(file => `
      <div class="attachment-preview-pill">${escapeHTML(file.name)}</div>
    `).join("");
  }
}

function readFileAsDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function consumePendingAttachments(){
  const attachments = normalizeAttachments(pendingAttachmentFiles);
  pendingAttachmentFiles = [];
  return attachments;
}

function parseFlexibleDateToken(token){
  const safeToken = String(token || "").trim().toLowerCase();
  const today = getNow();

  if(!safeToken){
    return null;
  }

  if(safeToken === "today"){
    return formatDateLocal(today);
  }

  if(safeToken === "tomorrow"){
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return formatDateLocal(tomorrow);
  }

  const slashMatch = safeToken.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);

  if(slashMatch){
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = slashMatch[3]
      ? Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3])
      : today.getFullYear();
    const parsed = new Date(year, month - 1, day);

    if(!Number.isNaN(parsed.getTime())){
      return formatDateLocal(parsed);
    }
  }

  const isoDate = parseLocalDate(safeToken);

  if(isoDate){
    return formatDateLocal(isoDate);
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const weekdayIndex = weekdays.indexOf(safeToken);

  if(weekdayIndex >= 0){
    const nextDate = new Date(today);
    const distance = (weekdayIndex - today.getDay() + 7) % 7 || 7;
    nextDate.setDate(today.getDate() + distance);
    return formatDateLocal(nextDate);
  }

  return null;
}

function extractHoursFromSmartText(text){
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(hours|hrs|hr|h)\b/i);

  if(hourMatch){
    return Math.max(0.25, Number(hourMatch[1]));
  }

  const minuteMatch = text.match(/(\d+)\s*(minutes|mins|min)\b/i);

  if(minuteMatch){
    return Math.max(0.25, Number(minuteMatch[1]) / 60);
  }

  return 1;
}

function parseSmartAssignmentText(text){
  const safeText = String(text || "").trim();
  const lower = safeText.toLowerCase();
  const classOptions = getAllKnownClassNames();
  let className = "General / Other";
  let type = "Homework";
  let priority = "Medium";
  let energyLevel = "Medium";
  let studyMode = "Normal";
  let gradeWeight = 0;
  let due = getTodayDateString();

  classOptions.forEach(option => {
    if(lower.includes(option.toLowerCase()) && option.length > className.length){
      className = option;
    }
  });

  ["Project", "Essay", "Quiz", "Test", "Studying", "Homework", "Other"].forEach(option => {
    if(lower.includes(option.toLowerCase())){
      type = option;
    }
  });

  ["Urgent", "High", "Medium", "Low"].forEach(option => {
    if(lower.includes(option.toLowerCase())){
      priority = option;
    }
  });

  if(lower.includes("deep work")){
    studyMode = "Deep Work";
  }else if(lower.includes("quick review")){
    studyMode = "Quick Review";
  }else if(lower.includes("test prep") || type === "Test" || type === "Quiz"){
    studyMode = "Test Prep";
  }

  if(lower.includes("high energy") || lower.includes("hard")){
    energyLevel = "High";
  }else if(lower.includes("low energy") || lower.includes("easy")){
    energyLevel = "Low";
  }

  const gradeMatch = lower.match(/(\d{1,3})\s*%/);

  if(gradeMatch){
    gradeWeight = clampGradeWeight(gradeMatch[1]);
  }

  const dueMatch = lower.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);

  if(dueMatch){
    due = parseFlexibleDateToken(dueMatch[1]) || due;
  }

  const hours = extractHoursFromSmartText(lower);
  const inferredClassMatch = safeText.match(/^([A-Za-z/& ]+?)\s+(project|essay|quiz|test|homework)\b/i);

  if(className === "General / Other" && inferredClassMatch){
    className = inferredClassMatch[1].trim();
  }

  const cleanedTitle = safeText
    .replace(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig, "")
    .replace(/(\d+(?:\.\d+)?)\s*(hours|hrs|hr|h|minutes|mins|min)\b/ig, "")
    .replace(/\b(urgent|high|medium|low)\b/ig, "")
    .replace(/\b(priority|worth|weight|study mode)\b/ig, "")
    .replace(/\b(test prep|deep work|quick review)\b/ig, "")
    .replace(/\b(project|essay|quiz|test|studying|homework|other)\b/ig, "")
    .replace(/\d{1,3}\s*%/g, "")
    .replace(new RegExp(`^${String(className).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "")
    .replace(/\s+/g, " ")
    .replace(/^[,:\-\s]+|[,:\-\s]+$/g, "");

  return {
    title: cleanedTitle || `${className} ${type}` || safeText || "New Assignment",
    className,
    type,
    priority,
    assigned: getTodayDateString(),
    due,
    hours,
    gradeWeight,
    energyLevel,
    studyMode
  };
}

function fillAssignmentFormFromParsed(parsed){
  document.getElementById("title").value = parsed.title || "";
  document.getElementById("class").value = parsed.className || "General / Other";
  document.getElementById("type").value = parsed.type || "Homework";
  document.getElementById("priority").value = parsed.priority || "Medium";
  document.getElementById("assigned").value = parsed.assigned || getTodayDateString();
  document.getElementById("due").value = parsed.due || getTodayDateString();
  document.getElementById("hours").value = parsed.hours || 1;
  document.getElementById("gradeWeight").value = parsed.gradeWeight || "";
  document.getElementById("energyLevel").value = parsed.energyLevel || "Medium";
  document.getElementById("studyMode").value = parsed.studyMode || "Normal";
  openQuickAdd("assignment");
}

function parseNaturalLanguageAssignment(){
  const textarea = document.getElementById("naturalLanguageInput");
  const rawText = textarea?.value || "";

  if(!rawText.trim()){
    alert("Please type an assignment description first.");
    return;
  }

  const parsed = parseSmartAssignmentText(rawText);

  if(!parsed.title){
    alert("Please type an assignment description first.");
    return;
  }

  fillAssignmentFormFromParsed(parsed);
}

function previewHomeworkPhoto(){
  const input = document.getElementById("scanPhotoInput");
  const previewWrap = document.getElementById("scanPreviewWrap");
  const previewImage = document.getElementById("scanPreviewImage");
  const file = input?.files?.[0];

  if(!file || !previewWrap || !previewImage){
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    previewImage.src = String(reader.result || "");
    previewWrap.classList.remove("hidden");
  };

  reader.readAsDataURL(file);
}

async function runHomeworkPhotoScan(){
  const input = document.getElementById("scanPhotoInput");
  const output = document.getElementById("scanExtractedText");
  const file = input?.files?.[0];

  if(!file){
    alert("Please choose a photo first.");
    return;
  }

  if(!window.Tesseract || typeof window.Tesseract.createWorker !== "function"){
    alert("Photo scan is not available right now because the OCR library did not load.");
    return;
  }

  if(output){
    output.value = "Scanning homework photo...";
  }

  const worker = await window.Tesseract.createWorker("eng");
  const result = await worker.recognize(file);
  await worker.terminate();

  if(output){
    output.value = result?.data?.text || "";
  }
}

function useScannedTextAsAssignment(){
  const text = document.getElementById("scanExtractedText")?.value || "";

  if(!text.trim()){
    alert("Scan a photo or paste text before using the scanned assignment flow.");
    return;
  }

  fillAssignmentFormFromParsed(parseSmartAssignmentText(text));
}

function encodeShareSnapshot(snapshot){
  return btoa(unescape(encodeURIComponent(JSON.stringify(snapshot))));
}

function decodeShareSnapshot(encoded){
  try{
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  }catch(error){
    return null;
  }
}

function buildShareSnapshot(){
  return {
    generatedAt: new Date().toISOString(),
    schedule,
    assignments: assignments.map(item => ({
      ...item,
      attachments: normalizeAttachments(item.attachments).map(attachment => ({
        id: attachment.id,
        name: attachment.name,
        url: attachment.url,
        mimeType: attachment.mimeType
      }))
    })),
    busy,
    classProfiles,
    plannerPlus: getPlannerPlusSettingsSnapshot()
  };
}

function generateReadOnlyShareLink(){
  const output = document.getElementById("shareLinkOutput");
  const snapshot = buildShareSnapshot();
  const shareLink = `${window.location.origin}${window.location.pathname}?shared=1${SHARED_SNAPSHOT_HASH_KEY}${encodeShareSnapshot(snapshot)}`;

  if(output){
    output.value = shareLink;
  }
}

async function copyShareLink(){
  const value = document.getElementById("shareLinkOutput")?.value || "";

  if(!value){
    return;
  }

  await navigator.clipboard.writeText(value);
  alert("Read-only share link copied.");
}

function isReadOnlySharedView(){
  return sharedViewState.enabled;
}

function hydrateSharedViewIfPresent(){
  if(sharedViewState.hydrated){
    return;
  }

  sharedViewState.hydrated = true;

  if(!window.location.hash.startsWith(SHARED_SNAPSHOT_HASH_KEY)){
    return;
  }

  const snapshot = decodeShareSnapshot(
    window.location.hash.slice(SHARED_SNAPSHOT_HASH_KEY.length)
  );

  if(!snapshot){
    return;
  }

  sharedViewState.enabled = true;
  sharedViewState.sourceSnapshot = snapshot;
  schedule = normalizeScheduleData(snapshot.schedule) || getDefaultSchedule();
  scheduleWasSaved = true;
  assignments = normalizeAssignments(snapshot.assignments || []);
  busy = normalizeBusyItems(snapshot.busy || []);
  classProfiles = normalizeClassProfiles(snapshot.classProfiles || {});
  applyPlannerPlusSettingsSnapshot(snapshot.plannerPlus || {}, { persist: false });
}

function renderSharedModeBanner(){
  const banner = document.getElementById("sharedModeBanner");

  if(!banner){
    return;
  }

  if(!isReadOnlySharedView()){
    banner.innerHTML = "";
    banner.className = "";
    return;
  }

  banner.className = "shared-banner";
  banner.innerHTML = `
    <div class="shared-banner-title">Read-Only Shared Planner</div>
    <div class="shared-banner-copy">
      This link is a view-only snapshot for parents, tutors, or accountability partners. Editing controls are disabled in shared mode.
    </div>
  `;
}

function updateReadOnlyChromeState(){
  const floatingButton = document.getElementById("floatingAddButton");
  const quickRailButton = document.querySelector(".mini-plus-button");
  const settingsButton = document.querySelector('button[onclick="openSettingsDrawer()"]');
  const editRotationButton = document.querySelector('button[onclick="resetScheduleSetup()"]');
  const regenerateButton = document.getElementById("regenerateScheduleButton");

  [floatingButton, quickRailButton, settingsButton, editRotationButton, regenerateButton].forEach(element => {
    if(!element){
      return;
    }

    element.classList.toggle("hidden", isReadOnlySharedView());
  });
}

function exportPlannerJson(){
  const output = document.getElementById("shareLinkOutput");

  if(output){
    output.value = JSON.stringify(buildShareSnapshot(), null, 2);
  }
}

function getPreferredDailyWorkLimitHours(){
  return getPlannerPlusSettings().preferredDailyWorkLimitMinutes / 60;
}

function getDailyWorkCapHours(){
  return getPreferredDailyWorkLimitHours();
}

function isRecoveryModeEnabled(){
  return getPlannerPlusSettings().recoveryMode;
}

function getEnergyProfile(){
  return getPlannerPlusSettings().energyProfile;
}

function getEnergyWindowBucket(window){
  const midpoint = (window.start + window.end) / 2;
  const profile = getEnergyProfile();

  if(profile === "Lunch Sprinter"){
    if(midpoint <= 12.25){
      return "High";
    }

    if(midpoint <= 17){
      return "Medium";
    }

    return "Low";
  }

  if(profile === "Evening Focus"){
    if(midpoint >= 17.5 && midpoint <= 20.5){
      return "High";
    }

    if(midpoint >= 15.5 && midpoint < 17.5){
      return "Medium";
    }

    return "Low";
  }

  if(profile === "Afternoon Focus"){
    if(midpoint >= 15.5 && midpoint <= 18.5){
      return "High";
    }

    if(midpoint > 18.5){
      return "Medium";
    }

    return "Low";
  }

  if(midpoint >= 15.5 && midpoint <= 18.5){
    return "High";
  }

  if(midpoint > 18.5 || midpoint <= 12){
    return "Medium";
  }

  return "Low";
}

function getEnergyPenalty(assignment, window){
  const desired = normalizeEnergyLevel(assignment.energyLevel);
  const actual = getEnergyWindowBucket(window);

  if(desired === actual){
    return -0.55;
  }

  if(
    (desired === "High" && actual === "Medium") ||
    (desired === "Medium" && actual === "Low") ||
    (desired === "Medium" && actual === "High")
  ){
    return 0.25;
  }

  return 0.9;
}

function recordStudyHistoryEntry({
  assignmentId = null,
  title = "",
  className = "General / Other",
  minutes = 0,
  source = "focus-timer"
}){
  const roundedMinutes = Math.max(1, Math.round(Number(minutes || 0)));

  if(roundedMinutes <= 0){
    return;
  }

  studyHistory.push({
    id: createLocalId("history"),
    assignmentId,
    title,
    className,
    minutes: roundedMinutes,
    source,
    date: getTodayDateString(),
    createdAt: new Date().toISOString()
  });

  studyHistory = normalizeStudyHistory(studyHistory).slice(-500);
  persistPlannerPlusSettings("study history");
}

function getCompletedStudyDays(){
  return [...new Set(studyHistory.map(entry => entry.date))].sort();
}

function getCompletionStreak(){
  const dates = getCompletedStudyDays();

  if(dates.length === 0){
    return 0;
  }

  let streak = 0;
  let cursor = parseLocalDate(getTodayDateString());
  const dateSet = new Set(dates);

  while(cursor){
    const key = formatDateLocal(cursor);

    if(!dateSet.has(key)){
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getStudyAnalyticsSummary(){
  const monday = getMonday(getNow());
  const weekStart = formatDateLocal(monday);
  const weekEntries = studyHistory.filter(entry => entry.date >= weekStart);
  const totalWeekMinutes = weekEntries.reduce((sum, entry) => sum + entry.minutes, 0);
  const classTotals = {};

  weekEntries.forEach(entry => {
    classTotals[entry.className] = (classTotals[entry.className] || 0) + entry.minutes;
  });

  const topClass = Object.entries(classTotals)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    totalWeekMinutes,
    weekSessions: weekEntries.length,
    streakDays: getCompletionStreak(),
    topClassName: topClass?.[0] || "None yet",
    topClassMinutes: topClass?.[1] || 0
  };
}

function renderAnalyticsCard(){
  const sidebar = document.querySelector(".sidebar");

  if(!sidebar){
    return;
  }

  let card = document.getElementById("analyticsCard");

  if(!card){
    card = document.createElement("div");
    card.id = "analyticsCard";
    card.className = "card";
    sidebar.append(card);
  }

  const summary = getStudyAnalyticsSummary();

  card.innerHTML = `
    <div class="section-title">Progress Analytics</div>

    <div class="mini-stat-grid">
      <div class="mini-stat">
        <div class="kicker">THIS WEEK</div>
        <div class="hero-value">${Math.round(summary.totalWeekMinutes / 60 * 10) / 10}h</div>
      </div>

      <div class="mini-stat">
        <div class="kicker">STREAK</div>
        <div class="hero-value">${summary.streakDays} day${summary.streakDays === 1 ? "" : "s"}</div>
      </div>
    </div>

    <div class="insight-block">
      <div class="kicker">TOP CLASS</div>
      <div class="row-title">${escapeHTML(summary.topClassName)}</div>
      <div class="row-sub">${Math.round(summary.topClassMinutes)} min logged this week</div>
    </div>

    <div class="insight-block">
      <div class="kicker">COMPLETED SESSIONS</div>
      <div class="row-title">${summary.weekSessions}</div>
      <div class="row-sub">Tracked from the focus timer and completion tools.</div>
    </div>
  `;
}

function getFocusTimerTarget(){
  const plan = typeof getActiveSmartStudyPlan === "function"
    ? getActiveSmartStudyPlan()
    : null;

  if(!plan){
    return null;
  }

  const currentSession = typeof getCurrentPlannedSession === "function"
    ? getCurrentPlannedSession(plan)
    : null;

  if(currentSession && currentSession.kind === "study"){
    return {
      ...currentSession,
      sessionDate: getTodayDateString()
    };
  }

  const upcoming = typeof getUpcomingSessions === "function"
    ? getUpcomingSessions(plan, 1)[0]
    : null;

  if(upcoming){
    return {
      ...upcoming,
      sessionDate: upcoming.dateString
    };
  }

  return null;
}

function getFocusTimerElapsedSeconds(){
  if(!focusTimerState.running){
    return focusTimerState.elapsedSeconds;
  }

  return focusTimerState.elapsedSeconds + Math.max(0, Math.round((Date.now() - focusTimerState.startedAt) / 1000));
}

function formatTimerSeconds(totalSeconds){
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if(hours > 0){
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startFocusTimer(){
  if(isReadOnlySharedView()){
    return;
  }

  if(!focusTimerState.assignmentId){
    const target = getFocusTimerTarget();

    if(!target){
      alert("There is no scheduled study block ready for the focus timer right now.");
      return;
    }

    focusTimerState = normalizeFocusTimerState({
      ...focusTimerState,
      assignmentId: target.assignmentId,
      sessionId: target.id,
      sessionDate: target.sessionDate,
      sessionStart: target.start,
      sessionEnd: target.end,
      title: target.title,
      className: target.className
    });
  }

  focusTimerState.running = true;
  focusTimerState.startedAt = Date.now();
  saveJSON(FOCUS_TIMER_STORAGE_KEY, focusTimerState);
  renderFocusTimerCard();
}

function pauseFocusTimer(){
  focusTimerState.elapsedSeconds = getFocusTimerElapsedSeconds();
  focusTimerState.running = false;
  focusTimerState.startedAt = 0;
  saveJSON(FOCUS_TIMER_STORAGE_KEY, focusTimerState);
  renderFocusTimerCard();
}

function resetFocusTimer(){
  focusTimerState = normalizeFocusTimerState(null);
  saveJSON(FOCUS_TIMER_STORAGE_KEY, focusTimerState);
  renderFocusTimerCard();
}

function completeFocusTimerSession(){
  if(isReadOnlySharedView()){
    return;
  }

  const elapsedMinutes = Math.max(1, Math.round(getFocusTimerElapsedSeconds() / 60));

  if(focusTimerState.assignmentId !== null){
    assignments = assignments.map(item => {
      if(item.id !== focusTimerState.assignmentId){
        return item;
      }

      const remainingHours = Math.max(0, Number(item.hours || 0) - (elapsedMinutes / 60));

      return {
        ...item,
        hours: Number(remainingHours.toFixed(2)),
        completedHours: Number(((Number(item.completedHours || 0)) + (elapsedMinutes / 60)).toFixed(2)),
        completed: remainingHours <= 0.05 ? true : item.completed
      };
    });

    saveAssignments();
  }

  recordStudyHistoryEntry({
    assignmentId: focusTimerState.assignmentId,
    title: focusTimerState.title,
    className: focusTimerState.className || "General / Other",
    minutes: elapsedMinutes,
    source: "focus-timer"
  });

  resetFocusTimer();
  renderAll();
}

function renderFocusTimerCard(){
  const sidebar = document.querySelector(".sidebar");

  if(!sidebar){
    return;
  }

  let card = document.getElementById("focusTimerCard");

  if(!card){
    card = document.createElement("div");
    card.id = "focusTimerCard";
    card.className = "card";
    sidebar.prepend(card);
  }

  const target = focusTimerState.assignmentId !== null
    ? focusTimerState
    : getFocusTimerTarget();

  card.innerHTML = `
    <div class="section-title">Focus Timer</div>
    <div class="hero-value timer-readout">${formatTimerSeconds(getFocusTimerElapsedSeconds())}</div>
    <div class="row-sub">
      ${
        target
          ? `${escapeHTML(target.title)} · ${escapeHTML(target.className || "General / Other")}`
          : "Start the timer on the current or next planned study block."
      }
    </div>
    ${
      isReadOnlySharedView()
        ? `<div class="row-sub" style="margin-top:10px;">The timer is disabled in shared view.</div>`
        : `
          <div class="row-actions">
            <button onclick="${focusTimerState.running ? "pauseFocusTimer()" : "startFocusTimer()"}">
              ${focusTimerState.running ? "Pause" : "Start"}
            </button>
            <button class="ghost" onclick="completeFocusTimerSession()">Complete Session</button>
          </div>
          <div class="row-actions">
            <button class="ghost" onclick="resetFocusTimer()">Reset Timer</button>
          </div>
        `
    }
  `;
}

function renderPlannerPlusPanels(){
  const host = document.getElementById("plannerPlusPanels");

  if(!host){
    return;
  }

  const classNames = getAllKnownClassNames();
  const analytics = getStudyAnalyticsSummary();

  host.innerHTML = `
    <div class="card settings-card planner-plus-card">
      <div class="section-title">Smart Planning</div>
      <div class="muted-copy">The planner treats this as a target, not a hard stop. It will go past it when due-soon work needs the time.</div>

      <div class="field-grid">
        <div>
          <label for="preferredDailyWorkLimitMinutes">Preferred Daily Work Limit in Minutes</label>
          <input id="preferredDailyWorkLimitMinutes" type="number" min="30" step="15" value="${escapeHTML(plannerPlusSettings.preferredDailyWorkLimitMinutes)}" />
        </div>

        <div>
          <label for="energyProfile">Energy Profile</label>
          <select id="energyProfile">
            ${["Balanced", "Afternoon Focus", "Evening Focus", "Lunch Sprinter"].map(option => `
              <option ${plannerPlusSettings.energyProfile === option ? "selected" : ""}>${escapeHTML(option)}</option>
            `).join("")}
          </select>
        </div>
      </div>

      <label class="toggle-row" for="recoveryMode">
        <span>Catch-up recovery mode</span>
        <input id="recoveryMode" type="checkbox" ${plannerPlusSettings.recoveryMode ? "checked" : ""} />
      </label>

      <button onclick="saveAdvancedPlannerSettings()">Save Smart Planning</button>
    </div>

    <div class="card settings-card planner-plus-card">
      <div class="section-title">Smart Notifications</div>
      <label class="toggle-row" for="notificationsEnabled">
        <span>Enable browser reminders for study blocks and due work</span>
        <input id="notificationsEnabled" type="checkbox" ${notificationSettings.enabled ? "checked" : ""} />
      </label>

      <label for="notificationLeadMinutes">Reminder Lead Time in Minutes</label>
      <input id="notificationLeadMinutes" type="number" min="1" step="1" value="${escapeHTML(notificationSettings.leadMinutes)}" />

      <div class="row-actions">
        <button onclick="saveNotificationPreferences()">Save Notifications</button>
        <button class="ghost" onclick="requestPlannerNotificationPermission()">Allow Notifications</button>
      </div>
    </div>

    <div class="card settings-card planner-plus-card">
      <div class="section-title">Class Profiles</div>
      <div class="class-profile-list">
        ${classNames.map(className => {
          const profile = getClassProfile(className);

          return `
            <div class="class-profile-row" data-class-profile-row data-class-name="${escapeHTML(className)}">
              <div class="row-title">${escapeHTML(className)}</div>
              <div class="field-grid">
                <div>
                  <label>Teacher</label>
                  <input data-class-profile-field="teacherName" value="${escapeHTML(profile.teacherName)}" placeholder="Teacher name" />
                </div>

                <div>
                  <label>Portal URL</label>
                  <input data-class-profile-field="portalUrl" value="${escapeHTML(profile.portalUrl)}" placeholder="Class portal link" />
                </div>
              </div>
              <label>Class Color</label>
              <input data-class-profile-field="color" type="color" value="${escapeHTML(profile.color)}" />
            </div>
          `;
        }).join("")}
      </div>
      <button onclick="updateClassProfilesFromUI()">Save Class Profiles</button>
    </div>

    <div class="card settings-card planner-plus-card">
      <div class="section-title">Recurring Homework Templates</div>
      <div class="muted-copy">Any assignment can become a template from the quick-add form. These templates auto-create future homework so nightly work does not have to be re-entered.</div>
      <div class="template-list">
        ${
          homeworkTemplates.length === 0
            ? `<div class="row-sub">No recurring templates yet.</div>`
            : homeworkTemplates.map(template => `
              <div class="template-row">
                <div class="row-title">${escapeHTML(template.title)}</div>
                <div class="row-sub">${escapeHTML(template.className)} · ${escapeHTML(template.repeat)} · due ${template.dueOffsetDays} day(s) after assignment</div>
                <div class="chip-row">
                  <span class="soft-chip">${formatHoursValue(template.hours)}</span>
                  <span class="soft-chip">${escapeHTML(template.studyMode)}</span>
                </div>
                <div class="row-actions">
                  <button onclick="generateTemplateAssignments('${escapeHTML(template.id)}')">Generate Upcoming</button>
                  <button class="ghost" onclick="deleteHomeworkTemplate('${escapeHTML(template.id)}')">Delete</button>
                </div>
              </div>
            `).join("")
        }
      </div>
    </div>

    <div class="card settings-card planner-plus-card">
      <div class="section-title">What-If Mode</div>
      <label class="toggle-row" for="whatIfEnabled">
        <span>Use temporary what-if blocks while testing alternate schedules</span>
        <input id="whatIfEnabled" type="checkbox" ${whatIfScenario.enabled ? "checked" : ""} onchange="toggleWhatIfScenarioEnabled()" />
      </label>

      <input id="whatIfTitle" placeholder="Temporary conflict" />

      <div class="field-grid">
        <div>
          <label for="whatIfDate">Date</label>
          <input id="whatIfDate" type="date" value="${escapeHTML(getTodayDateString())}" />
        </div>

        <div>
          <label for="whatIfStart">Start</label>
          <input id="whatIfStart" type="time" />
        </div>
      </div>

      <label for="whatIfEnd">End</label>
      <input id="whatIfEnd" type="time" />

      <div class="row-actions">
        <button onclick="addWhatIfBlock()">Add What-If Block</button>
      </div>

      <div class="template-list">
        ${
          whatIfScenario.blocks.length === 0
            ? `<div class="row-sub">No temporary blocks yet.</div>`
            : whatIfScenario.blocks.map(block => `
              <div class="template-row">
                <div class="row-title">${escapeHTML(block.title)}</div>
                <div class="row-sub">${escapeHTML(block.date)} · ${escapeHTML(block.start)} - ${escapeHTML(block.end)}</div>
                <div class="row-actions">
                  <button class="ghost" onclick="deleteWhatIfBlock('${escapeHTML(block.id)}')">Delete</button>
                </div>
              </div>
            `).join("")
        }
      </div>
    </div>

    <div class="card settings-card planner-plus-card">
      <div class="section-title">Sharing, Analytics, and Install</div>
      <div class="row-sub">${Math.round(analytics.totalWeekMinutes / 60 * 10) / 10}h studied this week · ${analytics.streakDays} day streak · top class ${escapeHTML(analytics.topClassName)}</div>
      <div class="row-actions">
        <button onclick="generateReadOnlyShareLink()">Generate Share Link</button>
        <button class="ghost" onclick="copyShareLink()">Copy Link</button>
      </div>
      <div class="row-actions">
        <button class="ghost" onclick="exportPlannerJson()">Export JSON</button>
        <button class="ghost" onclick="promptInstallHomeworkPlanner()">Install App</button>
      </div>
      <textarea id="shareLinkOutput" rows="4" placeholder="Your read-only share link or exported planner JSON will appear here."></textarea>
    </div>
  `;
}

function templateMatchesDate(template, date){
  const weekday = date.getDay();

  if(template.repeat === "Daily"){
    return true;
  }

  if(template.repeat === "Weekdays"){
    return !isWeekend(date);
  }

  if(template.repeat === "Weekly"){
    return Number(template.anchorWeekday) === weekday;
  }

  return false;
}

function generateTemplateAssignments(templateId = "", daysAhead = 14){
  if(isReadOnlySharedView()){
    return;
  }

  const today = getNow();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 1);
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + daysAhead);
  let changed = false;

  homeworkTemplates.forEach(template => {
    if(templateId && template.id !== templateId){
      return;
    }

    const cursor = new Date(startDate);

    while(cursor <= endDate){
      if(templateMatchesDate(template, cursor)){
        const assignedDate = formatDateLocal(cursor);
        const dueDate = new Date(cursor);
        dueDate.setDate(dueDate.getDate() + template.dueOffsetDays);
        const dueDateString = formatDateLocal(dueDate);
        const instanceKey = `${template.id}:${assignedDate}`;
        const alreadyExists = assignments.some(item => item.templateInstanceKey === instanceKey);

        if(!alreadyExists){
          assignments.push(normalizeAssignment({
            id: Date.now() + Math.floor(Math.random() * 100000),
            title: template.title,
            className: template.className,
            type: template.type,
            priority: template.priority,
            assigned: assignedDate,
            due: dueDateString,
            hours: template.hours,
            resourceUrl: template.resourceUrl,
            notes: template.notes,
            gradeWeight: template.gradeWeight,
            energyLevel: template.energyLevel,
            studyMode: template.studyMode,
            subtasks: template.subtasks,
            attachments: [],
            completed: false,
            source: "template",
            templateId: template.id,
            templateInstanceKey: instanceKey,
            createdAt: new Date().toISOString()
          }));
          changed = true;
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  });

  if(changed){
    saveAssignments();
    renderAll();
  }
}

function ensureRecurringTemplateAssignments(){
  if(homeworkTemplates.length === 0 || isReadOnlySharedView()){
    return;
  }

  generateTemplateAssignments("", 14);
}

function deleteHomeworkTemplate(templateId){
  if(isReadOnlySharedView()){
    return;
  }

  homeworkTemplates = homeworkTemplates.filter(template => template.id !== templateId);
  persistPlannerPlusSettings("recurring templates");
  renderPlannerPlusPanels();
}

async function requestPlannerNotificationPermission(){
  if(!("Notification" in window)){
    alert("Browser notifications are not supported in this browser.");
    return;
  }

  await Notification.requestPermission();
  renderPlannerPlusPanels();
}

function maybePlayNotificationSound(){
  try{
    const audio = new Audio("assets/sounds/notification.mp3");
    void audio.play();
  }catch(error){
    console.warn("Could not play notification sound", error);
  }
}

function firePlannerNotification(key, title, body){
  if(notificationLog[key]){
    return;
  }

  notificationLog[key] = new Date().toISOString();
  saveJSON("plannerNotificationLog", notificationLog);
  maybePlayNotificationSound();

  if("Notification" in window && Notification.permission === "granted"){
    new Notification(title, { body });
  }
}

function runPlannerNotificationsCheck(){
  if(!notificationSettings.enabled || !("Notification" in window) || Notification.permission !== "granted"){
    return;
  }

  if(typeof getActiveSmartStudyPlan !== "function"){
    return;
  }

  const plan = getActiveSmartStudyPlan();
  const now = getNow();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const today = getTodayDateString();
  const leadHours = notificationSettings.leadMinutes / 60;
  const todaySessions = plan.sessionsByDate[today] || [];

  todaySessions
    .filter(session => session.kind === "study")
    .forEach(session => {
      if(session.start >= currentHour && session.start - currentHour <= leadHours){
        firePlannerNotification(
          `session-${today}-${session.id}`,
          `Study block starting soon`,
          `${session.title} starts at ${decimalHourToTime(session.start)}.`
        );
      }
    });

  assignments
    .filter(item => !item.completed && getDaysUntil(item.due) <= 0)
    .forEach(item => {
      firePlannerNotification(
        `due-${today}-${item.id}`,
        `Assignment due now`,
        `${item.title} for ${item.className} is due ${item.due}.`
      );
    });
}

function promptInstallHomeworkPlanner(){
  if(!deferredInstallPrompt){
    alert("Install isn’t ready yet on this device. If your browser supports it, use the browser’s Add to Home Screen or Install App option.");
    return;
  }

  deferredInstallPrompt.prompt();
}

function registerInstallPromptCapture(){
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });
}

async function registerHomeworkPlannerServiceWorker(){
  if(!("serviceWorker" in navigator)){
    return;
  }

  try{
    await navigator.serviceWorker.register("sw.js?v=20260508-expansion");
  }catch(error){
    console.warn("Service worker registration failed", error);
  }
}

function initializeFocusTimerHeartbeat(){
  if(focusTimerInterval){
    clearInterval(focusTimerInterval);
  }

  focusTimerInterval = setInterval(() => {
    if(focusTimerState.running){
      renderFocusTimerCard();
    }
  }, 1000);
}

function initializePlannerPlus(){
  registerInstallPromptCapture();
  void registerHomeworkPlannerServiceWorker();
  initializeFocusTimerHeartbeat();
}
