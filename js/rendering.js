function hourToPixels(hour){
  return (hour-8)*80;
}

function renderMajorAssignment(){

  const banner =
  document.getElementById(
    "majorAssignmentBanner"
  );

  const major =
  assignments
  .filter(a=>
    a.type === "Project" ||
    a.type === "Essay" ||
    a.type === "Test"
  )
  .sort((a,b)=>
    new Date(a.due)-new Date(b.due)
  )[0];

  if(!major){

    banner.innerHTML =
    "No Major Assignments";

    return;
  }

  banner.innerHTML = `
    <h2>${major.title}</h2>
    <p>${major.className}</p>
    <p>Due ${major.due}</p>
  `;
}
