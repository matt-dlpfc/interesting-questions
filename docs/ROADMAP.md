# Roadmap

## Phase 0 — Foundation ✅ in progress
- Repository, README, licenses, decision log
- Starter question set (~30) in `content/questions.json`

## Phase 1 — The core moment
- Pick a theme → ~5 questions, one at a time → skip / rate 1–10 / next / leave
- Questions come from `content/questions.json`; ratings stored only on the device
- Mobile-first, big text, dark mode, keeps the screen awake
- Installable (PWA), works offline
- Deployed on Netlify
- No database and no gate yet — nothing private to protect

## Phase 2 — The pool
- Invite codes + "remember this device" + soft slowdown on failed attempts
- Database; starter questions imported into it
- Shared ratings (one per member per question)
- Submit a question → admin approval queue
- Admin screen: review queue, create/revoke invite codes
- "My submissions" status for each member

## Phase 3 — Playlists
- Shared curated sets drawn from the pool

## Phase 4 — Later, maybe
- Smarter selection using ratings
- Gradual depth within a session
- Member invites (capped)
- Private drafts
- Optional real accounts (see D6)
