let assignments = loadJSON("assignments", []);

function updateDateFields(){
  const typeSelect = document.getElementById("type");
  const wrapper = document.getElementById("assignedWrapper");

  if(!typeSelect || !wrapper) return;

  wrapper.style.display =
    typeSelect.value === "Homework"
      ? "block"
      : "none";
}

function addAssignment(){
  const titleInput = document.getElementById("title");
  const classInput = document.getElementById("class");
  const typeInput = document.getElementById("type");
  const assignedInput = document.getElementById("assigned");
  const dueInput = document.getElementById("due");
  const hoursInput = document.getElementById("hours");

  const title = titleInput.value.trim();
  const due = dueInput.value;

  if(!title){
    alert("Please enter an assignment title.");
    return;
  }

  if(!due){
    alert("Please choose a due date.");
    return;
  }

  const type = typeInput.value;

  assignments.push({
    id:Date.now(),
    title:title,
    className:classInput.value,
    type:type,
    assigned:type === "Homework" ? assignedInput.value : null,
    due:due,
    hours:Number(hoursInput.value || 1),
    completed:false,
    createdAt:new Date().toISOString()
  });

  saveAssignments();

  titleInput.value = "";
  hoursInput.value = "";
  assignedInput.value = formatDateLocal(new Date());
  dueInput.value = formatDateLocal(new Date());

  renderAll();
}

function toggleAssignmentComplete(id){
  assignments = assignments.map(assignment => {
    if(assignment.id === id){
      return {
        ...assignment,
        completed:!assignment.completed
      };
    }

    return assignment;
  });

  saveAssignments();
  renderAll();
}

function deleteAssignment(id){
  assignments = assignments.filter(assignment => assignment.id !== id);
  saveAssignments();
  renderAll();
}
