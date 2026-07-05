CREATE TYPE user_role AS ENUM ('client', 'admin');

ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'client';
