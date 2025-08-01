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
    // Attempt to fetch data via our optional Express backend first. If it fails
    // (e.g. when running on GitHub Pages where no backend exists), fall back
    // to using a public CORS proxy. The backend endpoint lives at /api/hiscore?player=NAME.
    let url = `/api/hiscore?player=${encodeURIComponent(username)}`;
    let response;
    try {
      response = await fetch(url);
      // If the backend returns an error status, treat as failure and fall back.
      if (!response.ok) {
        throw new Error('Backend request failed');
      }
    } catch (err) {
      // Fall back to the public CORS proxy. This makes the app work on static
      // hosts like GitHub Pages where no Node server is running.
      url =
        'https://corsproxy.io/?https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=' +
        encodeURIComponent(username);
      response = await fetch(url);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
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

// -----------------------------------------------------------------------------
// Gear item data and populating logic
//
// To provide a more authentic equipment selection experience, each gear slot
// now lists common RuneScape items appropriate for that slot instead of
// generic tags like "melee" or "magic". Because loading a complete list of
// every item in the game would significantly increase the bundle size and
// require cross‑origin requests, we include curated lists of popular and
// representative items for each slot. Players can still choose "None" if
// they do not wish to equip anything in a slot.

// A mapping from slot names (matching the data-slot attribute on each select)
// to arrays of item names. Feel free to extend these lists with additional
// favourites. The first entry in each array should be omitted here because
// the HTML already includes a "None" option by default.
const gearItems = {
  head: [
    'Helm of neitiznot',
    'Neitiznot faceguard',
    'Serpentine helm',
    'Void knight helm',
    'Void ranger helm',
    'Void melee helm',
    'Void mage helm',
    'Torva full helm',
    'Guthan\'s helm',
    'Dharok\'s helm',
    'Verac\'s helm',
    'Karil\'s coif',
    'Ahrim\'s hood',
    'Crystal helm',
    'Mystic hat',
    'Bandos helmet',
    'Berserker helm',
    'Rune full helm',
    'Dragon full helm',
    'Black mask',
    'Slayer helmet',
    'Circlet of water',
    'Spiny helm',
    'Armadyl helmet',
    'Ancestral hat',
    'Masori mask',
    'Inquisitor\'s great helm',
    'Fighter hat',
    'Third age full helmet',
    'Dwarven helmet'
  ],
  neck: [
    'Amulet of glory',
    'Amulet of eternal glory',
    'Amulet of fury',
    'Amulet of torture',
    'Amulet of accuracy',
    'Amulet of power',
    'Amulet of strength',
    'Amulet of magic',
    'Amulet of defence',
    'Blood fury',
    'Phoenix necklace',
    'Bonecrusher necklace',
    'Dragonbone necklace',
    'Necklace of anguish',
    'Occult necklace',
    'Salve amulet',
    'Salve amulet (e)',
    'Salve amulet (i)',
    'Salve amulet (ei)',
    'Amulet of avarice',
    'Amulet of ranging',
    '3rd age amulet',
    'Gnome amulet',
    'Dodgy necklace',
    'Sorrow necklace',
    'Torc of the elements'
  ],
  body: [
    'Torva platebody',
    'Bandos chestplate',
    'Guthan\'s platebody',
    'Dharok\'s platebody',
    'Verac\'s brassard',
    'Karil\'s leathertop',
    'Ahrim\'s robe top',
    'Armadyl chestplate',
    'Ancestral robe top',
    'Masori body',
    'Justiciar chestguard',
    'Dragon chainbody',
    'Dragon platebody',
    'Rune platebody',
    'Granite body',
    'Mystic robe top',
    'Proselyte hauberk',
    'Fighter torso',
    'Obsidian platebody',
    'Elite void top',
    'Void knight top',
    'Initiate hauberk',
    'Skeletal top',
    'Spined body'
  ],
  legs: [
    'Torva platelegs',
    'Bandos tassets',
    'Guthan\'s chainskirt',
    'Dharok\'s platelegs',
    'Verac\'s plateskirt',
    'Karil\'s leatherskirt',
    'Ahrim\'s robe skirt',
    'Armadyl chainskirt',
    'Ancestral robe bottom',
    'Masori chaps',
    'Justiciar legguards',
    'Dragon platelegs',
    'Dragon plateskirt',
    'Rune platelegs',
    'Granite legs',
    'Proselyte cuisse',
    'Mystic robe bottom',
    'Elite void robe',
    'Void knight robe',
    'Initiate cuisse',
    'Skeletal legs',
    'Spined chaps',
    'Black d\'hide chaps'
  ],
  weapon: [
    'Abyssal whip',
    'Abyssal tentacle',
    'Abyssal bludgeon',
    'Dragon scimitar',
    'Dragon longsword',
    'Dragon dagger',
    'Dragon claws',
    'Dragon mace',
    'Dragon sword',
    'Dragon warhammer',
    'Dragon 2h sword',
    'Dragon spear',
    'Dragon hasta',
    'Dragon halberd',
    'Dragon crossbow',
    'Dragon hunter crossbow',
    'Dragon hunter lance',
    'Dragon pickaxe',
    'Dragon harpoon',
    'Toxic blowpipe',
    'Magic shortbow',
    'Seercull',
    'Twisted bow',
    'Bow of faerdhinen',
    'Crystal bow',
    'Rune crossbow',
    'Armadyl crossbow',
    'Karil\'s crossbow',
    'Zaryte crossbow',
    'Arclight',
    'Saradomin sword',
    'Zamorakian hasta',
    'Zamorakian spear',
    'Bandos godsword',
    'Armadyl godsword',
    'Zamorak godsword',
    'Saradomin godsword',
    'Inquisitor\'s mace',
    'Ghrazi rapier',
    'Osmumten\'s fang',
    'Staff of the dead',
    'Toxic staff of the dead',
    'Staff of light',
    'Trident of the seas',
    'Trident of the swamp',
    'Sanguinesti staff',
    'Kodai wand',
    'Ancient scepter',
    'Elder maul',
    'Scythe of vitur',
    'Viggora\'s chainmace',
    'Ursine chainmace',
    'Vine whip',
    'Staff of balance',
    'Thammaron\'s sceptre',
    'Heavy ballista',
    'Light ballista',
    'Granite maul',
    'Barrelchest anchor',
    'Leaf-bladed battleaxe',
    'Leaf-bladed sword',
    'Leaf-bladed spear',
    'Bone dagger',
    'Chaos spear (imbued)',
    'Crystal staff',
    'Third age longsword',
    'Saradomin staff',
    'Zamorak staff',
    'Guthix staff',
    'Ancient staff',
    'Slayer staff'
  ],
  shield: [
    'Dragon defender',
    'Avernic defender',
    'Rune defender',
    'Steel defender',
    'Bronze defender',
    'Dragonfire shield',
    'Dragonfire ward',
    'Ancient wyvern shield',
    'Crystal shield',
    'Twisted buckler',
    'Odium ward',
    'Malediction ward',
    'Elysian spirit shield',
    'Arcane spirit shield',
    'Spectral spirit shield',
    'Blessed spirit shield',
    'Holy book',
    'Unholy book',
    'Book of balance',
    'Book of war',
    'Book of law',
    'Book of darkness',
    'Book of truth',
    'Dragon square shield',
    'Dragon kiteshield',
    'Rune kiteshield',
    'Iron kiteshield',
    'Bronze kiteshield',
    'Iron square shield'
  ],
  hands: [
    'Barrows gloves',
    'Ferocious gloves',
    'Regen bracelet',
    'Combat bracelet',
    'Bracelet of ethereum (uncharged)',
    'Diamond bracelet',
    'Dragon gloves',
    'Torva gloves',
    'Bandos gloves',
    'Mystic gloves',
    'Infinity gloves',
    'Black d\'hide vambraces',
    'Blessed vambraces',
    'Void knight gloves',
    'Elite void gloves',
    'Karamja gloves 3',
    'Ice gloves',
    'Granite gloves',
    'Goldsmith gauntlets',
    'Gauntlets of solace',
    'Culinaromancer\'s gloves 10',
    'Dark gloves',
    'Skeletal gloves',
    'Spined gloves'
  ],
  boots: [
    'Primordial boots',
    'Pegasian boots',
    'Eternal boots',
    'Dragon boots',
    'Ranger boots',
    'Snakeskin boots',
    'Bandos boots',
    'Torva boots',
    'Guardian boots',
    'Granite boots',
    'Mystic boots',
    'Infinity boots',
    'Rune boots',
    'Mithril boots',
    'Climbing boots',
    'Spiked manacles',
    'Boots of lightness',
    'Fremennik boots',
    'Graceful boots',
    'Blessed boots',
    'Boots of stone',
    'Skele boots',
    'Spined boots',
    'Trailblazer boots'
  ],
  ring: [
    'Berserker ring',
    'Warrior ring',
    'Seers ring',
    'Archer ring',
    'Tyrannical ring',
    'Treasonous ring',
    'Ring of suffering',
    'Ring of recoil',
    'Ring of wealth',
    'Ring of life',
    'Ring of the gods',
    'Lightbearer',
    'Granite ring',
    'Guardian\'s ring',
    'Ring of dueling',
    'Explorer\'s ring 3',
    'Explorer\'s ring 4',
    'Diamond ring',
    'Ruby ring',
    'Emerald ring',
    'Sapphire ring',
    'Dragonstone ring',
    'Onyx ring',
    'Zenyte ring',
    'Bullseye ring',
    'Ring of zealots',
    'Gold ring'
  ],
  cape: [
    'Fire cape',
    'Infernal cape',
    'Mythical cape',
    'Ava\'s accumulator',
    'Ava\'s attractor',
    'Ava\'s assembler',
    'Max cape',
    'Ranging cape',
    'Magic cape',
    'Defence cape',
    'Attack cape',
    'Strength cape',
    'Hitpoints cape',
    'Prayer cape',
    'Slayer cape',
    'Fishing cape',
    'Cooking cape',
    'Quest point cape',
    'Saradomin cape',
    'Zamorak cape',
    'Guthix cape',
    'Ancient cape',
    'Infernal max cape',
    'Fire max cape',
    'Ardougne cloak 4',
    'Ardougne cloak 3',
    'Ardougne cloak 2',
    'Ardougne cloak 1',
    'Obsidian cape',
    'Soul cape',
    'Imbued saradomin cape',
    'Imbued zamorak cape',
    'Imbued guthix cape'
  ],
  ammo: [
    'Bronze arrows',
    'Iron arrows',
    'Steel arrows',
    'Mithril arrows',
    'Adamant arrows',
    'Rune arrows',
    'Amethyst arrows',
    'Dragon arrows',
    'Bronze bolts',
    'Iron bolts',
    'Steel bolts',
    'Mithril bolts',
    'Adamant bolts',
    'Rune bolts',
    'Dragon bolts',
    'Dragon bolts (e)',
    'Onyx bolts (e)',
    'Emerald bolts (e)',
    'Ruby bolts (e)',
    'Diamond bolts (e)',
    'Opal bolts (e)',
    'Pearl bolts (e)',
    'Topaz bolts (e)',
    'Sapphire bolts (e)',
    'Amethyst darts',
    'Rune darts',
    'Dragon darts',
    'Mithril darts',
    'Adamant darts',
    'Bronze javelins',
    'Iron javelins',
    'Steel javelins',
    'Mithril javelins',
    'Adamant javelins',
    'Rune javelins',
    'Dragon javelins',
    'Chinchompa',
    'Red chinchompa',
    'Black chinchompa'
  ],
  other: [
    'Saradomin godsword',
    'Bandos godsword',
    'Armadyl godsword',
    'Zamorak godsword',
    'Elder maul',
    'Armadyl crossbow',
    'Heavy ballista',
    'Dragon 2h sword',
    'Granite maul',
    'Dragon warhammer',
    'Barrelchest anchor',
    'Staff of light',
    'Bow of faerdhinen',
    'Karil\'s crossbow',
    'Ahrim\'s staff',
    'Osmumten\'s fang',
    'Inquisitor\'s mace',
    'Ancient godsword',
    'Thammaron\'s sceptre',
    'Viggora\'s chainmace',
    'Ursine chainmace'
  ]
};

/**
 * Populate each gear slot dropdown with item names.
 * This function iterates over every select element in the gear grid and
 * appends option elements for each predefined item. The first option
 * ("None") remains untouched so players can leave a slot empty.
 */
function populateGearDropdowns() {
  const selects = document.querySelectorAll('#gear-grid select');
  selects.forEach((select) => {
    const slot = select.getAttribute('data-slot');
    if (!slot || !gearItems[slot]) return;
    // Remove any existing options except the first (None)
    const firstOption = select.querySelector('option');
    select.innerHTML = '';
    if (firstOption) {
      select.appendChild(firstOption);
    }
    // Append items for this slot
    gearItems[slot].forEach((itemName) => {
      const opt = document.createElement('option');
      opt.value = itemName;
      opt.textContent = itemName;
      select.appendChild(opt);
    });
  });
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
      // Chambers of Xeric rewards versatility. Previously this raid
      // required players to equip both melee and ranged items via
      // broad gear tags. Now that each gear slot lists individual
      // items instead of tag categories, we no longer enforce
      // specific gear requirements. Any gear loadout counts.
      gear: []
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
      // Theatre of Blood is extremely punishing; originally it required a
      // combination of melee and tank gear tags. Since our gear
      // selector now lists concrete items, we remove those tag
      // requirements. Players must still meet the stat and quest
      // thresholds.
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
      // Tombs of Amascut demands both magic prowess and adequate
      // prayer bonuses for survival. We remove concrete gear tag
      // requirements and instead rely on the player’s overall stats.
      gear: []
    }
  },
  {
    name: 'Zulrah',
    image: 'https://via.placeholder.com/80x50?text=Zulrah',
    guide: 'https://oldschool.runescape.wiki/w/Zulrah',
    requirements: {
      combat: 70,
      prayer: 45,
      stats: {
        ranged: 60,
        hitpoints: 75
      },
      quests: ['Regicide'],
      // Zulrah requires high ranged and hitpoints, along with completion of Regicide.
      gear: []
    }
  },
  {
    name: 'Vorkath',
    image: 'https://via.placeholder.com/80x50?text=Vorkath',
    guide: 'https://oldschool.runescape.wiki/w/Vorkath',
    requirements: {
      combat: 90,
      prayer: 50,
      stats: {
        strength: 80,
        ranged: 75,
        hitpoints: 90
      },
      quests: ['Dragon Slayer II'],
      // Vorkath is gated behind Dragon Slayer II and demands high combat stats.
      gear: []
    }
  },
  {
    name: 'The Nightmare',
    image: 'https://via.placeholder.com/80x50?text=Nightmare',
    guide: 'https://oldschool.runescape.wiki/w/The_Nightmare',
    requirements: {
      combat: 80,
      prayer: 50,
      stats: {
        defence: 70,
        hitpoints: 80
      },
      quests: ['Priest in Peril'],
      // The Nightmare is a high-level boss requiring strong defence and HP, plus Priest in Peril.
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

  // Collect gear selections keyed by slot. Each select has a data-slot
  // attribute (e.g. head, neck, body, etc.) and a value containing
  // the item name. Store non-empty selections in an object for easy
  // persistence and lookup when loading a saved profile.
  const gear = {};
  document.querySelectorAll('.gear-slot select').forEach((select) => {
    const slot = select.getAttribute('data-slot');
    const value = select.value.trim();
    if (value) {
      gear[slot] = value;
    }
  });

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
    // Check gear requirements (currently unused). Convert the player's gear
    // selections from an object into an array of item names for comparison.
    if (req.gear) {
      const playerGearItems = Object.values(player.gear || {});
      for (const tag of req.gear) {
        if (!playerGearItems.includes(tag)) return false;
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
    // Convert player's gear selections (stored as an object) into an array of item names.
    const playerGearItems = Object.values(player.gear || {});
    for (const tag of req.gear) {
      if (!playerGearItems.includes(tag)) {
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

/**
 * Save the current profile (stats, quests and gear) to localStorage.
 * The profile is stored under the key 'osrs-profile' as a JSON string.
 */
function saveProfile() {
  const player = getPlayerData();
  try {
    localStorage.setItem('osrs-profile', JSON.stringify(player));
    showMessage('Profile saved.', 'success');
  } catch (err) {
    console.error('Could not save profile:', err);
    showMessage('Failed to save profile.', 'error');
  }
}

/**
 * Load a saved profile from localStorage and populate the form fields.
 * If no profile exists, nothing happens. This runs on page load.
 */
function loadProfile() {
  const data = localStorage.getItem('osrs-profile');
  if (!data) return;
  try {
    const player = JSON.parse(data);
    // Populate numeric fields
    ['combat', 'prayer', 'attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && typeof player[id] !== 'undefined') {
        el.value = player[id];
      }
    });
    // Populate quest checkboxes
    const questBoxes = document.querySelectorAll('.quest-checkboxes input[type="checkbox"]');
    questBoxes.forEach((box) => {
      box.checked = Array.isArray(player.quests) && player.quests.includes(box.value);
    });
    // Populate gear selects
    const gear = player.gear || {};
    document.querySelectorAll('.gear-slot select').forEach((select) => {
      const slot = select.getAttribute('data-slot');
      select.value = gear[slot] || '';
    });
  } catch (err) {
    console.error('Could not load profile:', err);
  }
}

/**
 * Clear the saved profile from localStorage and reset all form fields to default.
 */
function clearProfile() {
  localStorage.removeItem('osrs-profile');
  // Reset form inputs
  document.getElementById('stats-form').reset();
  // Manually reset gear selects
  document.querySelectorAll('.gear-slot select').forEach((select) => {
    select.value = '';
  });
  // Clear quest checkboxes
  document.querySelectorAll('.quest-checkboxes input[type="checkbox"]').forEach((box) => {
    box.checked = false;
  });
  showMessage('Profile cleared.', 'success');
}

// Register our event listener once the DOM is loaded. This ensures the button
// exists when we attach the click handler.
document.addEventListener('DOMContentLoaded', () => {
  // Populate the gear selectors with item names on page load
  populateGearDropdowns();
  // Load the player's saved profile if it exists to prefill stats, quests and gear
  loadProfile();

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

  // Set up Save and Clear profile buttons
  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveProfile);
  }
  const clearBtn = document.getElementById('clear-profile-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearProfile);
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