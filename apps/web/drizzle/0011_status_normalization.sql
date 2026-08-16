-- Normalize the MVP order lifecycle to draft / paid / cancelled.
-- Legacy statuses are converted in place; display codes are preserved.
-- 'completed' and 'inventory_variance' were paid orders, 'sync_pending'
-- was an open offline ticket that must be picked up as a draft again.
UPDATE orders SET status = 'paid' WHERE status IN ('completed', 'inventory_variance');
UPDATE orders SET status = 'draft' WHERE status = 'sync_pending';