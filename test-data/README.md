# University Database Schema

This folder contains the DDL definitions for a university database system.

## Overview

The database manages:
- **Students** - Student enrollment and personal information
- **Teachers** - Faculty members and their employment details
- **Classes** - Course offerings with capacity and schedule information
- **Enrollments** - Many-to-many relationship between students and classes
- **Instructors** - Many-to-many relationship between teachers and classes

## Entity Relationships

```
Students ──┬── Enrollments ──┬── Classes
           │                 │
           └─────────────────┴── Class Instructors ──── Teachers
```

## Enum Types

| Type | Values | Description |
|------|--------|-------------|
| `student_status` | active, inactive, graduated, suspended | Current enrollment status |
| `semester` | fall, spring, summer | Academic term |
| `employment_type` | full_time, part_time, adjunct | Faculty employment classification |

## Tables

### Core Entities
1. **students** - Student records with status tracking
2. **teachers** - Faculty member records
3. **classes** - Course offerings

### Junction Tables
4. **enrollments** - Links students to classes with grade tracking
5. **class_instructors** - Links teachers to classes they teach

## Notes

- All tables use `SERIAL` for auto-incrementing primary keys
- Foreign keys enforce referential integrity
- Timestamps track record creation and updates
