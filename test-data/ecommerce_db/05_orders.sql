-- Orders table

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    shipping_address_id INTEGER NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    subtotal NUMERIC(10, 2) NOT NULL,
    shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    placed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_order_shipping_address
        FOREIGN KEY (shipping_address_id) REFERENCES addresses(id)
);

COMMENT ON TABLE orders IS 'Customer orders with status tracking and totals';
COMMENT ON COLUMN orders.total IS 'subtotal + shipping_cost + tax';
COMMENT ON COLUMN orders.placed_at IS 'Timestamp when the customer submitted the order';
