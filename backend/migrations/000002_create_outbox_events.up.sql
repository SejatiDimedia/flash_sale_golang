-- 5. Table Outbox Events (Transactional Outbox Pattern for Zero Message Loss)
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL, -- e.g. 'ORDER'
    aggregate_id UUID NOT NULL,          -- e.g. order_id
    event_type VARCHAR(100) NOT NULL,     -- e.g. 'order.pending', 'order.confirmed'
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PUBLISHED', 'FAILED'
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast polling by Outbox Relay Worker
CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created ON outbox_events(status, created_at);
