PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO workspaces (id, name, slug) VALUES ('ws_northstar', 'Northstar Studio', 'northstar-studio');
INSERT OR IGNORE INTO users (id, display_name, email) VALUES
  ('usr_maya', 'Maya Chen', 'maya@example.test'),
  ('usr_leo', 'Leo Park', 'leo@example.test'),
  ('usr_sam', 'Sam Rivera', 'sam@example.test'),
  ('usr_ari', 'Ari Kim', 'ari@example.test');
INSERT OR IGNORE INTO memberships (workspace_id, user_id, role) VALUES
  ('ws_northstar', 'usr_maya', 'owner'),
  ('ws_northstar', 'usr_leo', 'member'),
  ('ws_northstar', 'usr_sam', 'member'),
  ('ws_northstar', 'usr_ari', 'viewer');
INSERT OR IGNORE INTO projects (id, workspace_id, name, key_prefix) VALUES
  ('pr_product', 'ws_northstar', 'Product launch', 'LCH'),
  ('pr_website', 'ws_northstar', 'Website refresh', 'WEB');
INSERT OR IGNORE INTO tasks (id, workspace_id, project_id, sequence, title, description, status, priority, assignee_id, created_by, due_date) VALUES
  ('task_128', 'ws_northstar', 'pr_product', 128, 'Map the first-run workspace setup', 'Make the path from invitation to first useful board feel obvious.', 'inbox', 'high', 'usr_maya', 'usr_maya', '2026-10-16'),
  ('task_133', 'ws_northstar', 'pr_product', 133, 'Add a keyboard shortcut guide', 'Give frequent users a quick way to learn navigation and task shortcuts.', 'inbox', 'normal', 'usr_leo', 'usr_maya', '2026-10-18'),
  ('task_121', 'ws_northstar', 'pr_product', 121, 'Build the task detail panel', 'Show activity, owner, priority, and status without losing board context.', 'progress', 'urgent', 'usr_maya', 'usr_maya', '2026-10-14'),
  ('task_126', 'ws_northstar', 'pr_product', 126, 'Connect search to board filters', 'Keep text search and priority filters fast and easy to clear.', 'progress', 'high', 'usr_sam', 'usr_maya', '2026-10-15'),
  ('task_115', 'ws_northstar', 'pr_product', 115, 'Review empty and error states', 'Document what teammates see when a list has no tasks or cannot load.', 'review', 'normal', 'usr_ari', 'usr_maya', '2026-10-15'),
  ('task_109', 'ws_northstar', 'pr_product', 109, 'Ship workspace navigation', 'Make boards and settings easy to find across the app.', 'done', 'low', 'usr_leo', 'usr_maya', '2026-10-11');
INSERT OR IGNORE INTO activity_events (id, workspace_id, task_id, actor_id, event_type, payload_json) VALUES
  ('act_128', 'ws_northstar', 'task_128', 'usr_maya', 'created', '{}'),
  ('act_133', 'ws_northstar', 'task_133', 'usr_maya', 'created', '{}'),
  ('act_121', 'ws_northstar', 'task_121', 'usr_maya', 'status_changed', '{"from":"inbox","to":"progress"}'),
  ('act_126', 'ws_northstar', 'task_126', 'usr_maya', 'status_changed', '{"from":"inbox","to":"progress"}'),
  ('act_115', 'ws_northstar', 'task_115', 'usr_maya', 'status_changed', '{"from":"progress","to":"review"}'),
  ('act_109', 'ws_northstar', 'task_109', 'usr_maya', 'status_changed', '{"from":"review","to":"done"}');
