-- The Tikkie link made for a reclaim / combined request (pasted back from the
-- Tikkie app), and when a reminder was last sent for it. The older tikkie_link
-- columns hold descriptions typed before, so they are left alone.
alter table reclaims add column tikkie_url text, add column tikkie_reminded_at timestamptz;
alter table payment_requests add column tikkie_url text, add column tikkie_reminded_at timestamptz;
