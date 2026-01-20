-- Database setup script (not a table or enum - should appear gray in file tree)

CREATE DATABASE university;

GRANT ALL PRIVILEGES ON DATABASE university TO admin_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
