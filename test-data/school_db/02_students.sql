-- Students table

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_number VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    date_of_birth DATE,
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status student_status NOT NULL DEFAULT 'active',
    gpa NUMERIC(3, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table and column comments
COMMENT ON TABLE students IS 'Stores student enrollment and personal information';
COMMENT ON COLUMN students.student_number IS 'Unique student ID assigned by registrar';
COMMENT ON COLUMN students.email IS 'Primary contact email, must be unique';
COMMENT ON COLUMN students.status IS 'Current enrollment status using student_status enum';
COMMENT ON COLUMN students.gpa IS 'Grade point average on 4.0 scale';
