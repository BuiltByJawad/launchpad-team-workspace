PRAGMA foreign_keys = ON;
INSERT OR IGNORE INTO users (id, display_name, email) VALUES ('usr_demo', 'Demo teammate', 'demo@launchpad.example.test');
INSERT OR IGNORE INTO memberships (workspace_id, user_id, role) VALUES ('ws_northstar', 'usr_demo', 'member');
