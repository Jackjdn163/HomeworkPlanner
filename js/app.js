let schedule = JSON.parse(
  localStorage.getItem("schedule")
) || {
  A:["Math","English","History","Science"],
  B:["Theatre","Spanish","Elective","Health/Fitness"]
};

document
.getElementById("todayText")
.innerHTML =
new Date().toLocaleDateString(
  "en-US",
  {
    weekday:"long",
    month:"long",
    day:"numeric"
  }
);

classes.forEach(c=>{

  document
  .getElementById("class")
  .innerHTML += `
    <option>${c}</option>
  `;
});

renderWeek();
updateDateFields();
