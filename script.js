// script.js
// This file contains the JavaScript needed to fetch player stats
// from the Old School RuneScape Hiscores API and automatically
// populate the combat and prayer levels. Additional functionality
// will be added in later steps.

/**
 * Fetch statistics for a given RuneScape username from the official
 * OSRS Hiscores API. Because the API does not include CORS headers,
 * we use the `corsproxy.io` service to proxy our request. The API
 * returns a plain text response where each line corresponds to a
 * skill, containing rank, level and experience separated by commas.
 *
 * Example line: `1500,60,273741` represents rank 1500, level 60,
 * experience 273,741 XP. The skill order is defined by Jagex; for
 * our purposes we only need the first few skills (Attack, Defence,
 * Strength, Hitpoints, Ranged, Prayer, Magic).
 */
// Store the most recently fetched stats so eligibility checks can prefer
// data from the API instead of manual inputs.
let playerStats = null;

async function fetchStats() {
  const usernameInput = document.getElementById('username');
  const username = usernameInput.value.trim();

  // Basic validation: ensure a username was entered.
  if (!username) {
    // Show a friendly error message instead of using alert()
    showMessage('Please enter a RuneScape username before fetching stats.', 'error');
    return;
  }

  try {
    // Construct the URL to the hiscores API via a CORS proxy.
    const url =
      'https://corsproxy.io/?https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=' +
      encodeURIComponent(username);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const text = await response.text();

    // Split the response by newline and then by comma to get an array of
    // [rank, level, experience] for each skill. The skill order is
    // defined by Jagex; see https://oldschool.runescape.wiki/w/Application_programming_interface#Skill_data
    const lines = text.trim().split('\n').map((line) => line.split(','));

    // Map of skill names to their index in the hiscores response.
    const skillNames = [
      'overall',
      'attack',
      'defence',
      'strength',
      'hitpoints',
      'ranged',
      'prayer',
      'magic'
      // We can extend this list later if we need more stats.
    ];

    const stats = {};
    skillNames.forEach((name, i) => {
      const [, level] = lines[i];
      stats[name] = parseInt(level, 10);
    });

    // Save stats globally so the eligibility logic can use them later.
    playerStats = {
      attack: stats.attack,
      strength: stats.strength,
      defence: stats.defence,
      hitpoints: stats.hitpoints,
      ranged: stats.ranged,
      prayer: stats.prayer,
      magic: stats.magic
    };

    // Populate individual stat fields so the user can see them and edit if needed.
    document.getElementById('attack').value = stats.attack;
    document.getElementById('strength').value = stats.strength;
    document.getElementById('defence').value = stats.defence;
    document.getElementById('hitpoints').value = stats.hitpoints;
    document.getElementById('ranged').value = stats.ranged;
    document.getElementById('magic').value = stats.magic;
    document.getElementById('prayer').value = stats.prayer;

    // Compute combat level and populate the field.
    const combatInput = document.getElementById('combat');
    const combatLevel = computeCombatLevel({
      attack: stats.attack,
      strength: stats.strength,
      defence: stats.defence,
      hitpoints: stats.hitpoints,
      ranged: stats.ranged,
      prayer: stats.prayer,
      magic: stats.magic
    });
    combatInput.value = combatLevel;
    // Show a success message when stats are fetched
    showMessage('Stats fetched successfully!', 'success');
  } catch (error) {
    // Handle errors gracefully. This includes network failures and invalid usernames.
    console.error(error);
    showMessage(
      'Failed to fetch hiscores data. Please check the username and try again later.',
      'error'
    );
  }
}

/**
 * Compute the combat level from individual skill levels using the OSRS formula.
 * The formula calculates a base component from Defence, Hitpoints and half
 * Prayer, then adds the highest of the melee, ranged or magic components.
 * See: https://oldschool.runescape.wiki/w/Combat_level#The_formula
 *
 * @param {Object} stats - An object containing individual skill levels.
 * @returns {number} The calculated combat level, rounded down to the nearest integer.
 */
function computeCombatLevel(stats) {
  const base = 0.25 * (stats.defence + stats.hitpoints + Math.floor(stats.prayer / 2));
  const melee = 0.325 * (stats.attack + stats.strength);
  const range = 0.325 * Math.floor(1.5 * stats.ranged);
  const mage = 0.325 * Math.floor(1.5 * stats.magic);
  return Math.floor(base + Math.max(melee, range, mage));
}

// -----------------------------------------------------------------------------
// UI helper: display messages to the user
// We'll show error or success notifications in a message div at the top of the form.
// A timeout ensures the message disappears after a few seconds. If another
// message appears before the previous one fades, we clear the existing timeout.

let messageTimeout = null;

/**
 * Display a notification message in the UI.
 *
 * @param {string} text - The text to display to the user.
 * @param {string} [type='error'] - The type of message: 'error' or 'success'.
 */
function showMessage(text, type = 'error') {
  const messageDiv = document.getElementById('message');
  if (!messageDiv) return;
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
  // Clear any existing timeout before setting a new one
  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }
  messageTimeout = setTimeout(() => {
    messageDiv.style.display = 'none';
    messageDiv.className = 'message';
    messageTimeout = null;
  }, 5000);
}

/*
 * Define the raids and their minimum requirements. Each raid object
 * contains a name and a `requirements` object. Requirements can
 * include minimum combat and prayer levels, specific skill thresholds,
 * quest prerequisites and gear tags. For this example we include
 * three popular raids with approximate requirements. Feel free to
 * adjust these values as needed.
 */
const raids = [
  {
    name: 'Chambers of Xeric (Raids 1)',
    image: 'https://via.placeholder.com/80x50?text=COX',
    guide: 'https://oldschool.runescape.wiki/w/Chambers_of_Xeric',
    requirements: {
      combat: 70,
      prayer: 43,
      stats: {
        attack: 70,
        strength: 70,
        defence: 70,
        hitpoints: 70
      },
      quests: ['Priest in Peril'],
      gear: [] // gear tags can be added later
    }
  },
  {
    name: 'Theatre of Blood (Raids 2)',
    image: 'https://via.placeholder.com/80x50?text=TOB',
    guide: 'https://oldschool.runescape.wiki/w/Theatre_of_Blood',
    requirements: {
      combat: 85,
      prayer: 55,
      stats: {
        attack: 85,
        strength: 85
      },
      quests: ['Desert Treasure'],
      gear: []
    }
  },
  {
    name: 'Tombs of Amascut',
    image: 'https://via.placeholder.com/80x50?text=TOA',
    guide: 'https://oldschool.runescape.wiki/w/Tombs_of_Amascut',
    requirements: {
      combat: 80,
      prayer: 50,
      stats: {
        defence: 80,
        hitpoints: 80
      },
      quests: ['Recipe for Disaster'],
      gear: []
    }
  }
];

/**
 * Gather the player’s data either from the fetched stats (if available)
 * or from the manual input fields. Also collect selected quests and
 * gear tags. For now the gear list is empty because the gear selector
 * hasn’t been implemented yet.
 *
 * @returns {Object} Player data including levels, quests and gear
 */
function getPlayerData() {
  // If stats were fetched, clone them to avoid mutation; otherwise read from inputs.
  const levels = playerStats
    ? { ...playerStats }
    : {
        attack: parseInt(document.getElementById('attack').value, 10) || 0,
        strength: parseInt(document.getElementById('strength').value, 10) || 0,
        defence: parseInt(document.getElementById('defence').value, 10) || 0,
        hitpoints: parseInt(document.getElementById('hitpoints').value, 10) || 0,
        ranged: parseInt(document.getElementById('ranged').value, 10) || 0,
        prayer: parseInt(document.getElementById('prayer').value, 10) || 0,
        magic: parseInt(document.getElementById('magic').value, 10) || 0
      };

  // Combat level may be auto‑filled or entered manually. We recompute if necessary.
  const combat = parseInt(document.getElementById('combat').value, 10) ||
    computeCombatLevel({
      ...levels,
      prayer: levels.prayer
    });

  // Collect completed quests from checkboxes.
  const questCheckboxes = document.querySelectorAll('.quest-checkboxes input[type="checkbox"]');
  const quests = Array.from(questCheckboxes)
    .filter((box) => box.checked)
    .map((box) => box.value);

  // Gear tags placeholder (empty until gear grid is implemented)
  const gear = [];

  return {
    ...levels,
    combat,
    quests,
    gear
  };
}

/**
 * Determine which raids the player qualifies for based on their levels,
 * quests and gear. The function filters the global `raids` array and
 * returns only those raids where all requirements are met.
 *
 * @param {Object} player - The player data returned from getPlayerData().
 * @returns {Array} List of raid objects the player can access.
 */
function checkEligibility(player) {
  return raids.filter((raid) => {
    const req = raid.requirements;
    // Check minimum combat level
    if (req.combat && player.combat < req.combat) return false;
    // Check minimum prayer level
    if (req.prayer && player.prayer < req.prayer) return false;
    // Check specific skill requirements
    if (req.stats) {
      for (const [stat, minLevel] of Object.entries(req.stats)) {
        if (player[stat] < minLevel) return false;
      }
    }
    // Check quest prerequisites
    if (req.quests) {
      for (const quest of req.quests) {
        if (!player.quests.includes(quest)) return false;
      }
    }
    // Check gear requirements (currently empty)
    if (req.gear) {
      for (const tag of req.gear) {
        if (!player.gear.includes(tag)) return false;
      }
    }
    return true;
  });
}

/**
 * Determine which requirements the player fails for a given raid.
 * Returns an array of human‑readable strings explaining what’s missing.
 * If the array is empty, the raid is unlocked.
 *
 * @param {Object} raid - A raid definition from the `raids` array.
 * @param {Object} player - Player data returned from getPlayerData().
 */
function getMissingRequirements(raid, player) {
  const reasons = [];
  const req = raid.requirements;
  // Combat
  if (req.combat && player.combat < req.combat) {
    reasons.push(`Combat ${req.combat}+ required (current ${player.combat})`);
  }
  // Prayer
  if (req.prayer && player.prayer < req.prayer) {
    reasons.push(`Prayer ${req.prayer}+ required (current ${player.prayer})`);
  }
  // Specific stats
  if (req.stats) {
    for (const [stat, minLevel] of Object.entries(req.stats)) {
      if (player[stat] < minLevel) {
        // Capitalize the stat name for display
        const name = stat.charAt(0).toUpperCase() + stat.slice(1);
        reasons.push(`${name} ${minLevel}+ required (current ${player[stat]})`);
      }
    }
  }
  // Quests
  if (req.quests) {
    for (const quest of req.quests) {
      if (!player.quests.includes(quest)) {
        reasons.push(`${quest} quest required`);
      }
    }
  }
  // Gear (future feature)
  if (req.gear) {
    for (const tag of req.gear) {
      if (!player.gear.includes(tag)) {
        reasons.push(`Missing gear: ${tag}`);
      }
    }
  }
  return reasons;
}

/**
 * Render all raids as cards. This function reads the player’s data,
 * determines the missing requirements for each raid and then builds
 * a card grid showing both unlocked and locked raids. Locked raids
 * are semi‑transparent and include a tooltip listing the requirements
 * you still need to meet.
 */
function displayResults() {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  // Build a container for raid cards
  const cardsContainer = document.createElement('div');
  cardsContainer.classList.add('raid-cards');

  // Get player data once for all raids
  const player = getPlayerData();

  raids.forEach((raid) => {
    // Determine missing requirements for this raid
    const missing = getMissingRequirements(raid, player);

    const card = document.createElement('div');
    card.classList.add('raid-card');
    if (missing.length > 0) {
      card.classList.add('locked');
      // Use the browser’s default tooltip by setting the title attribute
      card.setAttribute('title', missing.join('\n'));
    }

    // Raid image
    const img = new Image();
    img.src = raid.image;
    img.alt = raid.name;
    img.classList.add('raid-image');
    card.appendChild(img);

    // Raid name
    const nameEl = document.createElement('h3');
    nameEl.textContent = raid.name;
    card.appendChild(nameEl);

    // Guide link
    const link = document.createElement('a');
    link.href = raid.guide;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View guide';
    card.appendChild(link);

    cardsContainer.appendChild(card);
  });
  resultsDiv.appendChild(cardsContainer);
}

// Register our event listener once the DOM is loaded. This ensures the button
// exists when we attach the click handler.
document.addEventListener('DOMContentLoaded', () => {
  const fetchButton = document.getElementById('fetch-btn');
  if (fetchButton) {
    fetchButton.addEventListener('click', fetchStats);
  }

  // Attach the eligibility check to the Check Raids button
  const checkButton = document.getElementById('check-raids-btn');
  if (checkButton) {
    checkButton.addEventListener('click', () => {
      // Gather player data before checking raids
      const player = getPlayerData();
      // If the user hasn’t fetched stats and all manual fields are zero,
      // prompt them to enter values first. This avoids confusion when
      // everything is locked simply because no data was provided.
      const manualFieldsEmpty =
        playerStats === null &&
        player.attack === 0 &&
        player.strength === 0 &&
        player.defence === 0 &&
        player.hitpoints === 0 &&
        player.ranged === 0 &&
        player.prayer === 0 &&
        player.magic === 0;
      if (manualFieldsEmpty) {
        showMessage(
          'Please enter your stats or fetch them before checking raids.',
          'error'
        );
        return;
      }
      // Re-render the raid cards based on the current form values.
      displayResults();
    });
  }

  // Dark mode: restore user preference and set up toggle
  const toggleBtn = document.getElementById('dark-mode-toggle');
  if (toggleBtn) {
    // Apply saved preference on page load
    const savedMode = localStorage.getItem('osrs-dark-mode');
    if (savedMode === 'true') {
      document.body.classList.add('dark-mode');
    }
    // Set the initial icon based on the current mode
    toggleBtn.textContent = document.body.classList.contains('dark-mode')
      ? '☀️'
      : '🌙';
    // Toggle dark mode on click
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('osrs-dark-mode', isDark.toString());
      // Swap the icon
      toggleBtn.textContent = isDark ? '☀️' : '🌙';
    });
  }
});