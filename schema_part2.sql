CREATE TABLE complaint_images(id SERIAL PRIMARY KEY, complaint_id INT REFERENCES complaints(id), filename TEXT NOT NULL);
ALTER TABLE complaints ADD COLUMN ai_generated BOOLEAN DEFAULT false;
