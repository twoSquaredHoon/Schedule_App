# Schedule — phone app

The phone side of Schedule. Plain HTML, CSS and JavaScript, installed on your phone from the browser (Add to Home Screen). No App Store build needed.

- `index.html` — the three screens: **Home** (what you're doing now), **Switch** (where + what), **Meme** (pick one after switching)
- `app.js` — screen logic; talks to the server's `/api/...`
- `app.css`, `base.css` — the neumorphic look, light and dark (follows your phone's setting)
- `shared.js` — small helpers (timer format, API calls)
- `manifest.webmanifest`, `icon-*.png` — app name and icon for the home screen

The server in **Schedule_Website** hosts this folder at `/app/`, so keep the two folders side by side. See `Schedule_Website/README.md` for setup.

Tips:
- Tap the card on Home to switch.
- Type in a box and tap the round **+** (or press return) to add a new place or activity.
- Tap the pencil next to the **+** to edit: tap a place or activity to rename it, or delete it (tap the trash twice). Deleting only hides it from the app — past entries keep the name.
