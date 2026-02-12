-- Enum types for the ecommerce order management schema

CREATE TYPE order_status AS ENUM (
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
);

CREATE TYPE payment_status AS ENUM (
    'pending',
    'authorized',
    'captured',
    'failed',
    'refunded'
);

CREATE TYPE address_type AS ENUM (
    'billing',
    'shipping'
);
