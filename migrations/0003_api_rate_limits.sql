CREATE TABLE IF NOT EXISTS api_rate_limits (
  scope_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK(request_count >= 0),
  PRIMARY KEY (scope_key, window_start)
);
