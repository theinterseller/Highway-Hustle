# Highway Hustle

A real-time multiplayer motorbike combat racing game set on an Indian highway. Up to 6 riders race online (plus bots, up to 8 bikes), dodging trucks, auto rickshaws, cars and wandering cows, and punching each other off their bikes.

## Features

- Pseudo-3D highway with curves, hills, sunset sky, palm trees, dhabas, billboards and NH milestones, all drawn in code (no image files)
- Online multiplayer rooms with 4-letter codes and invite links, plus **Quick race vs bots** for solo play
- Combat: punch left or right when a rival rides beside you; 5 hits knock them off for 3 seconds
- Traffic that moves the same way for every player; crashing into it at speed costs health
- Bots with catch-up logic so races stay close; bots punch back
- HUD with position, lap, speed, health and a live race-progress bar; KO feed; countdown; results with times and KOs
- Keyboard controls on desktop, on-screen touch controls with auto-throttle on phones
- Reconnect keeps your place in the race, host hands over automatically, rooms close after 5 idle minutes

## Controls

| Action | Keyboard | Phone |
| --- | --- | --- |
| Steer | ← → or A D | ◀ ▶ buttons |
| Throttle / brake | ↑ ↓ or W S | Automatic / Brake button |
| Punch left / right | Z X or J K | 👊 L / R 👊 |
| Switch camera (high / low) | C | 🚁 button |

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. To play with a phone on the same Wi-Fi, open `http://<your-computer-IP>:3000`.

## Deploy on Render

1. Push this folder to a GitHub repository.
2. In Render choose New > Blueprint and pick the repository (it reads `render.yaml`), or create a Web Service with build command `npm install` and start command `npm start`.
3. Open the URL Render gives you. Health check: `/health`.

Game state is kept in memory, so run a single instance.

## Tests

```bash
npm test
```

Runs a one-lap race with a simulated rider and three bots and checks the results flow.
