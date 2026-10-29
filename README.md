# beHome TrustCycle

A clickable web app of the beHome TrustCycle concept: one Quality Agreement, set before booking and checked on
every visit. Made for a Service Marketing class. **Not an official Be Group product.**

It opens full screen on phones (and installs to the iPhone Home Screen from Safari's Share menu). On a laptop it
shows the phone in a frame, with a panel to jump to any screen; on a phone the same list opens from the round
menu button. Choices made on a screen are kept on that device until **Start over**.

## The screens

`screens/` holds the 20 boards of the original design prototype, unchanged: the guide, the DVF check and 18 phone
screens across 5 stages (pre-booking, booking, service delivery, post-service, rebooking), plus two screens added
for the app: a welcome screen and the journey map (the user flow, with progress ticks). Each file is an HTML
template plus a small `class Component` with the screen's state and click handlers. Edit a screen by editing its
file; the app reloads it as is.

| Folder | What's in it |
| --- | --- |
| `screens/` | One `.dc.html` file per screen, named as the screens link to each other |
| `js/dc.js` | Renders a screen file: `{{value}}` holes, `<sc-if>`, `<sc-for>`, click handlers |
| `js/app.js` | Phone frame, links between screens, the screen menu, the app's typeface |
| `js/screens.js` | The screen list in journey order: stage, number, side trips, Tasker-app screens |
| `js/store.js` | What the app remembers on the device: each screen's choices and the screens visited |
| `server.js` | Static file server used in production (`/healthz` answers `ok`) |

## Run it

```
npm start
```

Then open http://localhost:3000. No install step: there are no dependencies.

## Test it

```
npm install --no-save playwright && npx playwright install chromium
npm test
```

`tests/smoke.js` opens every screen on a laptop and a phone size, fails on any error, and saves screenshots to
`tests/screenshots/`. `tests/flow.js` taps through the main path from Welcome to 5.1 the way a presenter would,
checks that choices survive a reload and that Start over clears them, and that every link points at a real screen.

## Deploy

Railway (or any Node host) runs `npm start`, which listens on `$PORT`. In Railway: New project → Deploy from
GitHub repo → this repo. No variables are needed. Railway gives the app an `https://…up.railway.app` address;
open it in Safari on an iPhone and use Share → Add to Home Screen.
