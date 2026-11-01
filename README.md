# Interesting Questions

A small web app for having better conversations — with one person, a few, or a group.

When a conversation is stalling, someone says *"want to play the questions game?"*, picks a theme, and the app shows about five questions, one at a time. Nothing gets written down. Each question is just a spark. You can rate it (optional, 1–10), move to the next one, or leave whenever you want.

**The question is the unit of the app** — the way a song is the unit of Spotify.

## Status

🌱 Phase 1 — the core session works: pick who you're with and how deep, get ~5 questions one at a time, swap / rate / finish. Works offline and can be added to a phone's home screen. Ratings stay on the device.

See [docs/DECISIONS.md](docs/DECISIONS.md) for the product decisions and [docs/ROADMAP.md](docs/ROADMAP.md) for the phases.

## How it works (planned)

- **Invite-only.** Access is by a personal invite code. No accounts, no email, no personal data.
- **One shared pool of questions.** Everyone who's in contributes to the same pool. New questions wait for admin approval before going live.
- **Themes and playlists.** Questions are tagged by *topic*, *situation* and *intensity*; a session pulls ~5 questions that fit the chosen theme.
- **One phone per session.** Show it to the table, pass it around.

## Running it locally

Needs [Node.js](https://nodejs.org) 20.12 or newer.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` first (the local admin code is in it). Then open the address it prints. `npm run dev` also runs the API functions and a local database. The first time, and after pulling new migrations, apply them to the local database while the dev server is running:

```bash
npx netlify database migrations apply
```

`npm run build` produces the deployable site in `dist/`.

## Adding or editing questions

Edit [content/questions.json](content/questions.json). Each question needs a unique `id`, the `text`, one or more `topics`, one or more `situations` (from the fixed list at the top of the file) and an `intensity` (`light`, `medium` or `deep`).

The live app reads questions from the database, which was seeded from this file. To bring later edits across, generate a new migration (never edit one that has already been deployed):

```bash
node scripts/gen-starter-migration.mjs 20270101120000_update_starter_questions
```

Its `ON CONFLICT DO NOTHING` only adds new questions; changing an existing one needs a hand-written `UPDATE` migration.

## Repository layout

```
content/questions.json   starter questions (public, open-licensed)
src/                     the app (React + TypeScript, built with Vite)
netlify/functions/       the API (Netlify Functions)
netlify/database/        database migrations, applied automatically on deploy
scripts/                 helper scripts
public/                  icons
docs/DECISIONS.md        why things are the way they are
docs/ROADMAP.md          phases
netlify.toml             hosting settings
```

Questions contributed by members through the app live in the app's database, **not** in this repository.

## Secrets

This repository is public. **No secret ever goes in it** — invite codes, admin codes and database credentials live only in the hosting provider's environment settings. If you fork this, see [.env.example](.env.example) for what you need to set.

## License

- Code: [MIT](LICENSE)
- Starter questions in `content/`: [CC BY 4.0](content/LICENSE)
