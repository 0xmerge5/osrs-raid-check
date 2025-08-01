// server.js
// A lightweight Express server that proxies requests to the OSRS Hiscores API.
// Running a local backend eliminates reliance on public CORS proxies and
// allows us to implement simple caching to reduce repeated API calls.

const express = require('express');
const fetch = require('node-fetch');

const app = express();

// Configure port; default to 3000 or use environment variable
const PORT = process.env.PORT || 3000;

// In-memory cache to store results for a short period. Each entry
// contains the fetched data and the timestamp when it was cached.
const cache = new Map();

// Helper function to fetch hiscore data from Jagex. If a cached
// response exists and is less than five minutes old, return it.
async function getHiscoreData(player) {
  const cacheKey = player.toLowerCase();
  const now = Date.now();
  const cached = cache.get(cacheKey);
  // Cache entries expire after 5 minutes (300000 ms)
  if (cached && now - cached.timestamp < 300000) {
    return cached.data;
  }
  // Build the hiscores URL. Note: this endpoint returns plain text.
  const url = `https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${encodeURIComponent(
    player
  )}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch hiscore data');
  }
  const text = await response.text();
  // Cache the result before returning it
  cache.set(cacheKey, { data: text, timestamp: now });
  return text;
}

// API endpoint: /api/hiscore?player=USERNAME
// Returns hiscore data as plain text. If the player parameter is missing
// or empty, responds with a 400 status code.
app.get('/api/hiscore', async (req, res) => {
  const player = req.query.player;
  if (!player) {
    return res.status(400).send('Missing player parameter');
  }
  try {
    const data = await getHiscoreData(player);
    res.set('Content-Type', 'text/plain');
    res.send(data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching hiscore data');
  }
});

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});