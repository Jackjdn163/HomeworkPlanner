function renderAll(){
  renderMajorAssignment();
  renderAIInsights();
  renderAssignmentList();
  renderBusyList();
  renderWeek();
}

function renderMajorAssignment(){
  const banner = document.getElementById("majorAssignmentBanner");

  if(!banner) return;

  const todayString = formatDateLocal(new Date());

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
    .sort((a,b) => new Date(a.due) - new Date(b.due))[0];

  if(!major){
    banner.innerHTML = `
      <div style="font-size:0.78rem; font-weight:900; opacity:0.7; margin-bottom:6px;">
        NEXT MAJOR ASSIGNMENT
      </div>
      <div style="font-size:1.35rem; font-weight:900;">
        No Major Assignments
      </div>
      <div style="margin-top:6px; opacity:0.75;">
        You are clear for now.
      </div>
    `;
    return;
  }

  const daysLeft = getDaysUntil(major.due);

  banner.innerHTML = `
    <div style="font-size:0.78rem; font-weight:900; opacity:0.7; margin-bottom:6px;">
      NEXT MAJOR ASSIGNMENT
    </div>

    <div style="font-size:1.45rem; font-weight:950;">
      ${major.title}
    </div>

    <div style="margin-top:7px; opacity:0.8;">
      ${major.className} · ${major.type}
    </div>

    <div style="margin-top:7px; color:#fca5a5; font-weight:900;">
      Due ${major.due} · ${daysLeft <= 0 ? "Due today" : `${daysLeft} day(s) left`}
    </div>
  `;
}

function renderAssignmentList(){
  const list = document.getElementById("assignmentList");

  if(!list) return;

  if(assignments.length === 0){
    list.innerHTML = `<div class="row-sub">No assignments yet.</div>`;
    return;
  }

  const sorted = [...assignments].sort((a,b) => {
    if(a.completed !== b.completed){
      return a.completed ? 1 : -1;
    }

    return new Date(a.due) - new Date(b.due);
  });

  list.innerHTML = sorted.map(item => `
    <div class="assignment-row ${item.completed ? "complete" : ""}">
      <div class="row-title">${item.title}</div>
      <div class="row-sub">
        ${item.className} · ${item.type} · Due ${item.due} · ${item.hours || 1}h
      </div>

      <div class="row-actions">
        <button onclick="toggleAssignmentComplete(${item.id})">
          ${item.completed ? "Undo" : "Done"}
        </button>
        <button class="ghost" onclick="deleteAssignment(${item.id})">
          Delete
        </button>
      </div>
    </div>
  `).join("");
}

function renderBusyList(){
  const list = document.getElementById("busyList");

  if(!list) return;

  if(busy.length === 0){
    list.innerHTML = `<div class="row-sub">No busy times yet.</div>`;
    return;
  }

  list.innerHTML = busy.map(item => `
    <div class="busy-row">
      <div class="row-title">${item.title}</div>
      <div class="row-sub">
        ${item.repeat} · ${item.date} · ${item.start} - ${item.end}
      </div>

      <div class="row-actions">
        <button class="ghost" onclick="deleteBusy(${item.id})">
          Delete
        </button>
      </div>
    </div>
  `).join("");
}
