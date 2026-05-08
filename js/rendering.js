function renderAll(){
  if(typeof renderAccountPanel === "function"){
    renderAccountPanel();
  }

  if(typeof renderPlannerPlusPanels === "function"){
    renderPlannerPlusPanels();
  }

  if(typeof renderRegenerateScheduleButton === "function"){
    renderRegenerateScheduleButton();
  }

  if(typeof renderSharedModeBanner === "function"){
    renderSharedModeBanner();
  }

  if(typeof updateReadOnlyChromeState === "function"){
    updateReadOnlyChromeState();
  }

  if(typeof renderFocusTimerCard === "function"){
    renderFocusTimerCard();
  }

  if(typeof renderAnalyticsCard === "function"){
    renderAnalyticsCard();
  }

  renderMajorAssignment();
  renderAIInsights();
  renderAssignmentList();
  renderBusyList();
  renderWeek();
}

function renderMajorAssignment(){
  const banner = document.getElementById("majorAssignmentBanner");

  if(!banner){
    return;
  }

  const todayString = getTodayDateString();

  const major = assignments
    .filter(item =>
      !item.completed &&
      item.due >= todayString &&
      (
        item.type === "Project" ||
        item.type === "Essay" ||
        item.type === "Test" ||
        item.type === "Quiz"
      )
    )
    .sort((a, b) => parseLocalDate(a.due) - parseLocalDate(b.due))[0];

  if(!major){
    banner.innerHTML = `
      <div class="banner-label">NEXT MAJOR ASSIGNMENT</div>
      <div class="banner-title">No major assignments coming up</div>
      <div class="banner-copy">Your planner is clear right now.</div>
    `;
    return;
  }

  const daysLeft = getDaysUntil(major.due);

  banner.innerHTML = `
    <div class="banner-label">NEXT MAJOR ASSIGNMENT</div>
    <div class="banner-title">${escapeHTML(major.title)}</div>
    <div class="banner-copy">
      ${escapeHTML(major.className)} · ${escapeHTML(major.type)} · ${escapeHTML(major.priority)} priority
    </div>
    <div class="banner-copy banner-urgent">
      Due ${escapeHTML(major.due)} · ${daysLeft <= 0 ? "Due today" : `${daysLeft} day(s) left`}
    </div>
    <div class="chip-row">
      <span class="soft-chip">${formatHoursValue(major.hours)} remaining</span>
      ${major.gradeWeight > 0 ? `<span class="soft-chip">${escapeHTML(major.gradeWeight)}% of grade</span>` : ""}
      <span class="soft-chip">${escapeHTML(major.studyMode || "Normal")}</span>
    </div>
    ${getAssignmentLinkStatusHTML(major.resourceUrl, {
      linkLabel: "Open Assignment",
      linkClassName: "banner-link-button",
      emptyLabel: "No link attached",
      emptyClassName: "banner-empty-link-pill"
    })}
    <div class="link-row">
      ${getClassPortalStatusHTML(major.className, "Open Class Portal")}
    </div>
  `;
}

function renderAssignmentList(){
  const list = document.getElementById("assignmentList");

  if(!list){
    return;
  }

  if(assignments.length === 0){
    list.innerHTML = `<div class="row-sub">No assignments yet.</div>`;
    return;
  }

  const sorted = [...assignments].sort((a, b) => {
    if(a.completed !== b.completed){
      return a.completed ? 1 : -1;
    }

    const dueDifference = parseLocalDate(a.due) - parseLocalDate(b.due);

    if(dueDifference !== 0){
      return dueDifference;
    }

    return calculatePriority(b) - calculatePriority(a);
  });

  list.innerHTML = sorted.map(item => `
    <div
      class="assignment-row ${item.completed ? "complete" : ""}"
      style="border-left:4px solid ${escapeHTML(getClassAccent(item.className))};"
    >
      <div class="row-heading">
        <div class="row-title-group">
          <div class="row-title">${escapeHTML(item.title)}</div>
          ${getAssignmentLinkStatusHTML(item.resourceUrl, {
            linkLabel: "Open Link",
            linkClassName: "inline-link-button",
            emptyLabel: "No link attached",
            emptyClassName: "empty-link-pill"
          })}
        </div>
        <span class="priority-pill priority-${item.priority.toLowerCase()}">${escapeHTML(item.priority)}</span>
      </div>

      <div class="row-sub">
        ${escapeHTML(item.className)} · ${escapeHTML(item.type)} · Assigned ${escapeHTML(item.assigned)} · Due ${escapeHTML(item.due)}
      </div>

      <div class="chip-row">
        <span class="soft-chip">${formatHoursValue(item.hours)} remaining</span>
        ${item.completedHours > 0 ? `<span class="soft-chip">${formatHoursValue(item.completedHours)} done</span>` : ""}
        <span class="soft-chip">${escapeHTML(item.priority)} priority</span>
        ${item.gradeWeight > 0 ? `<span class="soft-chip">${escapeHTML(item.gradeWeight)}% grade impact</span>` : ""}
        <span class="soft-chip">${escapeHTML(item.energyLevel || "Medium")} energy</span>
        <span class="soft-chip">${escapeHTML(item.studyMode || "Normal")}</span>
      </div>

      ${item.notes ? `<div class="row-note">${escapeHTML(item.notes)}</div>` : ""}
      ${getAssignmentChecklistHTML(item, !isReadOnlySharedView())}
      ${getAssignmentAttachmentLinksHTML(item.attachments)}

      <div class="link-row">
        ${getClassPortalStatusHTML(item.className, "Class Portal")}
      </div>

      ${
        isReadOnlySharedView()
          ? ""
          : `
            <div class="row-actions">
              <button onclick="toggleAssignmentComplete(${item.id})">
                ${item.completed ? "Undo" : "Done"}
              </button>
              <button class="ghost" onclick="deleteAssignment(${item.id})">
                Delete
              </button>
            </div>
          `
      }
    </div>
  `).join("");
}

function renderBusyList(){
  const list = document.getElementById("busyList");

  if(!list){
    return;
  }

  if(busy.length === 0){
    list.innerHTML = `<div class="row-sub">No busy times yet.</div>`;
    return;
  }

  const sorted = [...busy].sort((a, b) => {
    const dateDifference = parseLocalDate(a.date) - parseLocalDate(b.date);

    if(dateDifference !== 0){
      return dateDifference;
    }

    return a.start.localeCompare(b.start);
  });

  list.innerHTML = sorted.map(item => `
    <div class="busy-row">
      <div class="row-title">${escapeHTML(item.title)}</div>
      <div class="row-sub">
        ${escapeHTML(item.repeat)} · ${escapeHTML(item.date)} · ${escapeHTML(item.start)} - ${escapeHTML(item.end)}
      </div>

      ${
        isReadOnlySharedView()
          ? ""
          : `
            <div class="row-actions">
              <button class="ghost" onclick="deleteBusy(${item.id})">
                Delete
              </button>
            </div>
          `
      }
    </div>
  `).join("");
}
