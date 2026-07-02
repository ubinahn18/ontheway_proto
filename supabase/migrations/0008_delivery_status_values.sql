-- new statuses for the two-step delivery confirmation flow: the selector
-- marks an item delivered, then the uploader confirms receipt. must live in
-- its own migration file because a new enum value can't be used in the same
-- transaction that adds it.
alter type item_status add value 'delivered';
alter type item_status add value 'completed';
