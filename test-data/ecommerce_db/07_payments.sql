-- Payments table

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    amount NUMERIC(10, 2) NOT NULL,
    processor VARCHAR(50) NOT NULL,
    processor_transaction_id VARCHAR(255),
    billing_address_id INTEGER,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_order
        FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_payment_billing_address
        FOREIGN KEY (billing_address_id) REFERENCES addresses(id)
);

COMMENT ON TABLE payments IS 'Payment attempts and their outcomes for an order';
COMMENT ON COLUMN payments.processor IS 'Payment gateway used, e.g. stripe, paypal';
COMMENT ON COLUMN payments.processor_transaction_id IS 'External transaction ID returned by the payment gateway';
