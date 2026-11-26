CREATE TABLE users(id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student', created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE complaints(id SERIAL PRIMARY KEY, tracking_id TEXT UNIQUE NOT NULL,
  user_id INT REFERENCES users(id),            -- NULL for anonymous complaints
  access_code_hash TEXT,                       -- secret code for anonymous tracking
  category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted', admin_remarks TEXT, department TEXT,
  created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE status_history(id SERIAL PRIMARY KEY, complaint_id INT REFERENCES complaints(id),
  status TEXT, remark TEXT, created_at TIMESTAMPTZ DEFAULT now());
