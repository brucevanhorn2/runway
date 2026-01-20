-- Class instructors table (many-to-many: teachers <-> classes)

CREATE TABLE class_instructors (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_instructor_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_instructor_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON DELETE CASCADE,
    UNIQUE (teacher_id, class_id)
);
