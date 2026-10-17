PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  slug TEXT NOT NULL UNIQUE CHECK(length(slug) BETWEEN 2 AND 60),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 100),
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','member','viewer')),
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id, workspace_id);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  key_prefix TEXT NOT NULL CHECK(length(key_prefix) BETWEEN 2 AND 8),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, key_prefix),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects(workspace_id, created_at);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 5000),
  status TEXT NOT NULL DEFAULT 'inbox' CHECK(status IN ('inbox','progress','review','done')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('urgent','high','normal','low')),
  assignee_id TEXT,
  created_by TEXT NOT NULL,
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (workspace_id, id),
  UNIQUE (project_id, sequence),
  FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, assignee_id) REFERENCES memberships(workspace_id, user_id),
  FOREIGN KEY (workspace_id, created_by) REFERENCES memberships(workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS tasks_board_idx ON tasks(workspace_id, project_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks(workspace_id, assignee_id, status);
CREATE INDEX IF NOT EXISTS tasks_priority_idx ON tasks(workspace_id, project_id, priority);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 3000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (workspace_id, task_id) REFERENCES tasks(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, author_id) REFERENCES memberships(workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS comments_task_idx ON comments(workspace_id, task_id, created_at);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('created','status_changed','priority_changed','assigned','commented','edited')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (workspace_id, task_id) REFERENCES tasks(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, actor_id) REFERENCES memberships(workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS activity_task_idx ON activity_events(workspace_id, task_id, created_at DESC);
