# Runway Test Data

This folder demonstrates Runway's **Database Boundary Grouping** feature. It contains two completely separate databases living side-by-side in the same project tree — a common monorepo pattern.

Open this folder in Runway (`File → Open Folder`), then click the **Group by Database** button (database icon) in the diagram toolbar to see each database surrounded by its own colored boundary box, with foreign key relationships visible across boundaries.

---

## school_db — University Database

**Color:** Sky Blue (`#4a9eff`)

Manages students, faculty, and course offerings for a university.

| File | Table / Type | Description |
|------|-------------|-------------|
| `01_enums.sql` | `student_status`, `semester`, `employment_type` | Shared enum types |
| `02_students.sql` | `students` | Student enrollment and personal info |
| `03_teachers.sql` | `teachers` | Faculty members and employment details |
| `04_classes.sql` | `classes` | Course offerings with capacity and schedule |
| `05_enrollments.sql` | `enrollments` | Many-to-many: students ↔ classes |
| `06_class_instructors.sql` | `class_instructors` | Many-to-many: teachers ↔ classes |

### Relationships

```
students ──── enrollments ──── classes ──── class_instructors ──── teachers
```

---

## ecommerce_db — Order Management Database

**Color:** Emerald (`#4caf87`)

A simple but complete order management system for an online store, covering customers, products, orders, and payments.

| File | Table / Type | Description |
|------|-------------|-------------|
| `01_enums.sql` | `order_status`, `payment_status`, `address_type` | Shared enum types |
| `02_customers.sql` | `customers` | Registered shoppers |
| `03_addresses.sql` | `addresses` | Billing and shipping addresses per customer |
| `04_products.sql` | `products` | Product catalog with pricing and inventory |
| `05_orders.sql` | `orders` | Customer orders with status and totals |
| `06_order_items.sql` | `order_items` | Line items within an order |
| `07_payments.sql` | `payments` | Payment attempts and gateway responses |

### Relationships

```
customers ──┬── addresses ◄── orders ──── order_items ──── products
            │                    │
            └────────────────────┴── payments
```

---

## How the `.runway-db` Files Work

Each database folder contains a `.runway-db` marker file:

```json
{
  "name": "Ecommerce DB",
  "color": "#4caf87",
  "description": "Order management, product catalog, and payment processing for an online store"
}
```

These files are plain JSON, safe to commit to version control, and can be created or edited directly in Runway by right-clicking any folder in the file tree.
