-- Customer addresses table

CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    type address_type NOT NULL DEFAULT 'shipping',
    line1 VARCHAR(255) NOT NULL,
    line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country CHAR(2) NOT NULL DEFAULT 'US',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_address_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE addresses IS 'Billing and shipping addresses belonging to a customer';
COMMENT ON COLUMN addresses.country IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN addresses.is_default IS 'Whether this is the customer default for its type';
