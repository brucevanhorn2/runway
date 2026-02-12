-- Order line items table

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    line_total NUMERIC(10, 2) NOT NULL,
    CONSTRAINT fk_item_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_item_product
        FOREIGN KEY (product_id) REFERENCES products(id)
);

COMMENT ON TABLE order_items IS 'Individual line items within an order';
COMMENT ON COLUMN order_items.unit_price IS 'Price at time of purchase, independent of current product price';
COMMENT ON COLUMN order_items.line_total IS 'quantity * unit_price';
