# C&C: Crypts & Coins

An original fantasy tabletop-RPG-inspired browser game: pick a class, roll the dice, explore dungeons and collect loot.

## Play

Open `index.html` in any modern browser. No build step or install needed. It is also published as a Claude artifact.

## Play together (co-op)

Two players can share one dungeon run. One player clicks **Create a room** and reads out the 4-letter code; the other types it under **Or join one** and clicks **Join**. Both pick a hero and the host clicks **Enter the Crypts together**.

- You move through the map as one party. Either player can move, open chests, pray or shop (the one who does it gets the reward or the roll).
- Fights are turn based: each hero acts once, then the enemy strikes one of you. Foes have more HP and +1 to hit in co-op.
- A hero who drops to 0 HP is **down**. Win the fight and they get back up; a Wardsinger's Mending Hymn also heals the partner and can lift them up mid-fight. The run ends when both heroes are down.
- Each hero has their own gold, gear, potions, levels and gifts. Campfires heal both of you.
- If someone's connection drops, the game reconnects by itself. If the partner is gone, the host can take their turns.

Co-op needs the small room server in `server.js`. It only passes messages between the two browsers; the host's browser runs the game.

## Hosting

`render.yaml` defines two Render services:

- **crypts-and-coins**: the solo game as a free static site. Never sleeps.
- **crypts-and-coins-coop**: a free Node web service that serves the game *and* the co-op rooms. Use this link to play together. Free instances sleep after 15 idle minutes, so the first visit after a break takes about a minute to load.

To create the co-op service by hand: **New > Web Service**, pick this repo, branch `main`, choose the **Free** instance type. If Render picks **Docker** as the language, leave it (the `Dockerfile` handles everything). If it picks **Node**, use build command `npm install` and start command `npm start`.

Run it locally with `npm install && npm start`, then open http://localhost:10000.

## How it plays

- **Four classes.** Ironclad (tough fighter), Hexweaver (star-mage), Shade (crit-happy rogue), Wardsinger (healer with a bell). Each has its own ability and passive.
- **Dice.** Attacks roll a d20 plus your Hit bonus against the enemy's Guard, then your weapon die for damage. A natural 20 doubles the damage dice. Traps, locked chests, shrines and fleeing are all dice rolls too.
- **Dungeon.** Every floor is a new random map with fog of war. Find the stairs to go deeper. A boss guards the stairs on every third floor.
- **Loot.** Weapons, armor and trinkets in four rarities (Common, Fine, Rare, Legendary). Equip upgrades or sell them. Spend gold at the lantern peddler.
- **Levels.** Level up and pick one of three gifts. Death is permanent; your best run is remembered.

Controls: click a glowing room or use arrow keys / WASD. In a fight, Space or 1 attacks, 2 uses your ability, 3 drinks a potion, 4 flees.

## Notes

All names, creatures, art and rules are original to this project. The current solo run auto-saves in your browser; a co-op run is kept by the host's browser tab.
