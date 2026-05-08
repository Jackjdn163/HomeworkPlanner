let assignments = normalizeAssignments(loadJSON("assignments", []));

function normalizeAssignments(items){
  if(!Array.isArray(items)){
    return [];
  }

  return items.map((item, index) => normalizeAssignment(item, index));
}

function normalizeAssignment(item, index = 0){
  const createdAt = item?.createdAt || new Date().toISOString();
  const fallbackDate = createdAt.slice(0, 10);
  const remainingHours = Math.max(0.25, Number(item?.hours || 1));

  return {
    id: Number(item?.id) || Date.now() + index,
    title: String(item?.title || "").trim(),
    className: String(item?.className || "General / Other").trim() || "General / Other",
    type: String(item?.type || "Homework"),
    priority: String(item?.priority || "Medium"),
    assigned: item?.assigned || fallbackDate,
    due: item?.due || fallbackDate,
    hours: remainingHours,
    originalHours: Math.max(remainingHours, Number(item?.originalHours || remainingHours)),
    completedHours: Math.max(0, Number(item?.completedHours || 0)),
    gradeWeight: clampGradeWeight(item?.gradeWeight),
    energyLevel: normalizeEnergyLevel(item?.energyLevel),
    studyMode: normalizeStudyMode(item?.studyMode),
    resourceUrl: normalizeAssignmentUrl(item?.resourceUrl || item?.url || ""),
    attachments: normalizeAttachments(item?.attachments),
    subtasks: normalizeSubtasks(item?.subtasks, item),
    notes: String(item?.notes || "").trim(),
    completed: Boolean(item?.completed),
    source: String(item?.source || "manual"),
    templateId: item?.templateId || "",
    templateInstanceKey: item?.templateInstanceKey || "",
    createdAt
  };
}

async function addAssignment(){
  if(isReadOnlySharedView()){
    return;
  }

  const titleInput = document.getElementById("title");
  const classInput = document.getElementById("class");
  const typeInput = document.getElementById("type");
  const priorityInput = document.getElementById("priority");
  const assignedInput = document.getElementById("assigned");
  const dueInput = document.getElementById("due");
  const hoursInput = document.getElementById("hours");
  const gradeWeightInput = document.getElementById("gradeWeight");
  const energyInput = document.getElementById("energyLevel");
  const studyModeInput = document.getElementById("studyMode");
  const resourceUrlInput = document.getElementById("resourceUrl");
  const subtaskSeedInput = document.getElementById("subtaskSeed");
  const notesInput = document.getElementById("notes");

  const title = titleInput.value.trim();
  const assigned = assignedInput.value;
  const due = dueInput.value;
  const hours = Math.max(0.25, Number(hoursInput.value || 1));
  const gradeWeight = clampGradeWeight(gradeWeightInput.value || 0);
  const energyLevel = normalizeEnergyLevel(energyInput.value || "Medium");
  const studyMode = normalizeStudyMode(studyModeInput.value || "Normal");
  const resourceUrl = normalizeAssignmentUrl(resourceUrlInput.value);
  const subtasks = parseSubtasksText(subtaskSeedInput.value, {
    title,
    type: typeInput.value,
    hours,
    studyMode
  });
  const attachments = consumePendingAttachments();

  if(!title){
    alert("Please enter an assignment title.");
    return;
  }

  if(!assigned){
    alert("Please choose the assigned date.");
    return;
  }

  if(!due){
    alert("Please choose a due date.");
    return;
  }

  if(assigned > due){
    alert("The assigned date cannot be after the due date.");
    return;
  }

  if(resourceUrlInput.value.trim() && !resourceUrl){
    alert("Please enter a valid assignment URL.");
    return;
  }

  assignments.push(normalizeAssignment({
    id: Date.now(),
    title,
    className: classInput.value || "General / Other",
    type: typeInput.value,
    priority: priorityInput.value,
    assigned,
    due,
    hours,
    originalHours: hours,
    completedHours: 0,
    gradeWeight,
    energyLevel,
    studyMode,
    resourceUrl,
    attachments,
    subtasks,
    notes: notesInput.value.trim(),
    completed: false,
    source: "manual",
    createdAt: new Date().toISOString()
  }));

  maybeSaveRecurringTemplateFromForm();
  saveAssignments();

  titleInput.value = "";
  hoursInput.value = "";
  resourceUrlInput.value = "";
  notesInput.value = "";
  assignedInput.value = getTodayDateString();
  dueInput.value = getTodayDateString();
  priorityInput.value = "Medium";
  resetAssignmentEnhancementFields();

  if(typeof closeQuickAdd === "function"){
    closeQuickAdd();
  }

  renderAll();
}

function toggleAssignmentComplete(id){
  if(isReadOnlySharedView()){
    return;
  }

  assignments = assignments.map(assignment => {
    if(assignment.id === id){
      const nextCompleted = !assignment.completed;

      if(nextCompleted){
        recordStudyHistoryEntry({
          assignmentId: assignment.id,
          title: assignment.title,
          className: assignment.className,
          minutes: Math.max(15, Math.round((Number(assignment.hours || 0.25)) * 60)),
          source: "assignment-complete"
        });
      }

      return {
        ...assignment,
        completed: nextCompleted
      };
    }

    return assignment;
  });

  saveAssignments();
  renderAll();
}

function deleteAssignment(id){
  if(isReadOnlySharedView()){
    return;
  }

  assignments = assignments.filter(assignment => assignment.id !== id);
  saveAssignments();
  renderAll();
}
