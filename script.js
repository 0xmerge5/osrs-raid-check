const raids = [
  {
    name: 'Chambers of Xeric',
    minCombat: 70,
    minPrayer: 43
  },
  {
    name: 'Theatre of Blood',
    minCombat: 90,
    minPrayer: 43
  },
  {
    name: 'Tombs of Amascut',
    minCombat: 80,
    minPrayer: 43
  }
];

function checkRaids() {
  const combat = parseInt(document.getElementById('combatLevel').value);
  const prayer = parseInt(document.getElementById('prayerLevel').value);
  const resultsDiv = document.getElementById('results');
  let output = '<h2>Eligible Raids:</h2><ul>';
  raids.forEach(raid => {
    if (combat >= raid.minCombat && prayer >= raid.minPrayer) {
      output += `<li>${raid.name}</li>`;
    }
  });
  output += '</ul>';
  resultsDiv.innerHTML = output;
}

// Helper Functions
function xpToLevel(xp) {
  let points = 0;
  for (let lvl = 1; lvl <= 126; lvl++) {
    points += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    if (Math.floor(points / 4) > xp) return lvl;
  }
  return 126;
}

function calculateCombatLevel(att, str, def, hp, range, mage, pray) {
  const attack = xpToLevel(att);
  const strength = xpToLevel(str);
  const defence = xpToLevel(def);
  const hitpoints = xpToLevel(hp);
  const ranged = xpToLevel(range);
  const magic = xpToLevel(mage);
  const prayer = xpToLevel(pray);

  const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (attack + strength);
  const rangeCombat = 0.325 * (Math.floor(ranged * 1.5));
  const mageCombat = 0.325 * (Math.floor(magic * 1.5));
  return base + Math.max(melee, rangeCombat, mageCombat);
}

async function fetchStats() {
  const username = document.getElementById('osrsUsername').value;
  if (!username) {
    alert('Please enter an RSN.');
    return;
  }
  const url = `https://corsproxy.io/?https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${encodeURIComponent(username)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Player not found');
    const text = await response.text();
    const lines = text.split('\n');
    const prayerXP = parseInt(lines[6].split(',')[2]);
    const hitpointsXP = parseInt(lines[4].split(',')[2]);
    const attackXP = parseInt(lines[1].split(',')[2]);
    const strengthXP = parseInt(lines[2].split(',')[2]);
    const defenceXP = parseInt(lines[3].split(',')[2]);
    const rangedXP = parseInt(lines[5].split(',')[2]);
    const magicXP = parseInt(lines[7].split(',')[2]);

    const combat = calculateCombatLevel(
      attackXP,
      strengthXP,
      defenceXP,
      hitpointsXP,
      rangedXP,
      magicXP,
      prayerXP
    );
    const prayerLevel = xpToLevel(prayerXP);
    document.getElementById('combatLevel').value = Math.floor(combat);
    document.getElementById('prayerLevel').value = prayerLevel;
    checkRaids();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// Load OSRS item names into the datalist
async function loadGearList() {
  try {
    const url = 'https://corsproxy.io/?https://www.osrsbox.com/osrsbox-db/items-summary.json';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch items list');
    const data = await response.json();
    const datalist = document.getElementById('gearList');
    datalist.innerHTML = '';
    Object.values(data).forEach(item => {
      const option = document.createElement('option');
      option.value = item.name;
      datalist.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading gear list:', err);
  }
}

window.addEventListener('DOMContentLoaded', loadGearList);
