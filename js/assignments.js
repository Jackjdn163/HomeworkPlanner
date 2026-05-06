let assignments = JSON.parse(
  localStorage.getItem("assignments")
) || [];

function updateDateFields(){

  const type =
  document.getElementById("type").value;

  document.getElementById(
    "assignedWrapper"
  ).style.display =
  type === "Homework"
  ? "block"
  : "none";
}

function addAssignment(){

  assignments.push({

    id:Date.now(),

    title:title.value,

    className:
    document.getElementById("class").value,

    type:type.value,

    assigned:
    type.value === "Homework"
    ? assigned.value
    : null,

    due:due.value,

    hours:hours.value || 1

  });

  saveAssignments();
  renderWeek();
}
