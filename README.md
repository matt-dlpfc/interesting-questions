# Interesting Questions

A small web app for having better conversations — with one person, a few, or a group.

When a conversation is stalling, someone says *"want to play the questions game?"*, picks a theme, and the app shows about five questions, one at a time. Nothing gets written down. Each question is just a spark. You can rate it (optional, 1–10), move to the next one, or leave whenever you want.

**The question is the unit of the app** — the way a song is the unit of Spotify.

## Status

🌱 Phase 0 — foundation. No app code yet.

See [docs/DECISIONS.md](docs/DECISIONS.md) for the product decisions and [docs/ROADMAP.md](docs/ROADMAP.md) for the phases.

## How it works (planned)

- **Invite-only.** Access is by a personal invite code. No accounts, no email, no personal data.
- **One shared pool of questions.** Everyone who's in contributes to the same pool. New questions wait for admin approval before going live.
- **Themes and playlists.** Questions are tagged by *topic*, *situation* and *intensity*; a session pulls ~5 questions that fit the chosen theme.
- **One phone per session.** Show it to the table, pass it around.

## Repository layout

```
content/questions.json   starter questions (public, open-licensed)
docs/DECISIONS.md        why things are the way they are
docs/ROADMAP.md          phases
```

Questions contributed by members through the app live in the app's database, **not** in this repository.

## Secrets

This repository is public. **No secret ever goes in it** — invite codes, admin codes and database credentials live only in the hosting provider's environment settings. If you fork this, see `.env.example` (coming with Phase 2) for what you need to set.

## License

- Code: [MIT](LICENSE)
- Starter questions in `content/`: [CC BY 4.0](content/LICENSE)
