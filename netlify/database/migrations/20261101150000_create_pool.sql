-- The shared pool (Phase 2). See docs/DECISIONS.md D1–D6.

-- An anonymous member. All data hangs off this ID so real accounts can be attached later (D6).
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One invite code per member, stored only as a keyed hash (D1). Revoked, never deleted.
CREATE TABLE invite_codes (
  id SERIAL PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id),
  code_hash TEXT NOT NULL UNIQUE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Starter and member questions. Rejected ones are hidden, not deleted (D4).
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  topics TEXT[] NOT NULL DEFAULT '{}',
  situations TEXT[] NOT NULL DEFAULT '{}',
  intensity TEXT NOT NULL CHECK (intensity IN ('light', 'medium', 'deep')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden')),
  submitted_by UUID REFERENCES members(id),
  suggested_tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX questions_status_idx ON questions (status);
CREATE INDEX questions_submitted_by_idx ON questions (submitted_by);

-- One rating per member per question.
CREATE TABLE ratings (
  member_id UUID NOT NULL REFERENCES members(id),
  question_id TEXT NOT NULL REFERENCES questions(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  situation TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, question_id)
);

-- Failed code attempts, for the soft slowdown. Deliberately no IP or other identifier (D1).
CREATE TABLE login_failures (
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX login_failures_at_idx ON login_failures (at);
