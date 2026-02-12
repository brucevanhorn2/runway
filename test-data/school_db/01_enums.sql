-- Enum types for the university schema

CREATE TYPE student_status AS ENUM (
    'active',
    'graduated',
    'withdrawn',
    'on_leave'
);

CREATE TYPE semester AS ENUM (
    'fall',
    'spring',
    'summer'
);

CREATE TYPE employment_type AS ENUM (
    'full_time',
    'part_time',
    'adjunct',
    'emeritus'
);
