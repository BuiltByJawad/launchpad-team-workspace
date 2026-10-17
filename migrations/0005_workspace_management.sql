PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('admin','member','viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, invited_by) REFERENCES memberships(workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_idx ON workspace_invitations(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workspace_invitations_email_idx ON workspace_invitations(email, expires_at);
