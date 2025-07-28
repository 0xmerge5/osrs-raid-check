const raids = [
  {
    name: "Chambers of Xeric",
    minCombat: 70,
    minPrayer: 43
  },
  {
    name: "Theatre of Blood",
    minCombat: 90,
    minPrayer: 43
  },
  {
    name: "Tombs of Amascut",
    minCombat: 80,
    minPrayer: 43
  }
];

function checkRaids() {
  const combat = parseInt(document.getElementById("combatLevel").value);
  const prayer = parseInt(document.getElementById("prayerLevel").value);
  const resultsDiv = document.getElementById("results");

  let output = "<h2>Eligible Raids:</h2><ul>";

  raids.forEach(raid => {
    if (combat >= raid.minCombat && prayer >= raid.minPrayer) {
      output += `<li>${raid.name}</li>`;
    }
  });

  output += "</ul>";
  resultsDiv.innerHTML = output;
}
