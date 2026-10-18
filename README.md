# Shishya

Shishya finds the exact algebra step each child gets wrong, lets them fix it by teaching the Shishya, and uses code (not AI) to decide when they have truly learned it.

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm run dev   # open http://localhost:3000
npm test      # run the unit tests
```

Demo data (kept apart from pilot data, in `data/demo.db`, and shown with a DEMO banner):

```bash
npm run seed:demo   # creates a demo class (PIN 123456), 5 demo students and some practice answers
npm run dev:demo    # runs the app on the demo data
```

Pilot data lives in `data/shishya.db` (not in git). Set `SESSION_SECRET` (32+ characters) in production.

## Licence

MIT, see [LICENSE](LICENSE).
