-- Classes table

CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    description TEXT,
    credits INTEGER NOT NULL DEFAULT 3,
    semester semester NOT NULL,
    year INTEGER NOT NULL,
    max_enrollment INTEGER DEFAULT 30,
    room_number VARCHAR(20),
    schedule VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_code, semester, year)
);
