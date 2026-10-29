# beHome TrustCycle

A clickable web app of the beHome TrustCycle concept: one Quality Agreement, set before booking and checked on
every visit. Made for a Service Marketing class. **Not an official Be Group product.**

It opens full screen on phones (and installs to the iPhone Home Screen from Safari's Share menu, and then works
offline). On a laptop it shows the phone in a frame, with a panel to jump to any screen; on a phone the same list
opens from the menu button at the right of each screen's header. Choices made on a screen are kept on that device
until **Start over**.

## The screens

`screens/` holds the 20 boards of the original design prototype: the guide and the DVF check (unchanged), and 18
phone screens across 5 stages (pre-booking, booking, service delivery, post-service, rebooking), restyled to the v2
design after the beHome app, plus two screens added for the app: a welcome screen (the beHome home) and the journey
map (the user flow, with progress ticks). Each file is an HTML
template plus a small `class Component` with the screen's state and click handlers. Edit a screen by editing its
file; the app reloads it as is.

| Folder | What's in it |
| --- | --- |
| `screens/` | One `.dc.html` file per screen, named as the screens link to each other |
| `js/dc.js` | Renders a screen file: `{{value}}` holes, `<sc-if>`, `<sc-for>`, click handlers |
| `css/kit.css` | The v2 screen kit shared by the phone screens: header, white sections, bottom bar, controls |
| `img/v2/` | Pictures in the screens: the home banner, the Taskers and the after-photos |
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
books at 5.1 and follows the journey map's next steps, checks that choices survive a reload, that Start over asks
before clearing them, that an unknown address opens Welcome, that the Welcome picture and the menu work on a
390×844 and a 375×667 iPhone, that each screen's header menu button opens the screen menu, and that every link
points at a real screen.

## Deploy

The app is deployed on Railway from this GitHub repo: Railway runs `npm start`, which listens on `$PORT`, and
redeploys on every push to `main`. No variables are needed.

Live demo: https://behome-trustcycle-production.up.railway.app

Open it in Safari on an iPhone and use Share → Add to Home Screen. Any other Node host works the same way.
