/*
# Add cash_app_link column to admin_payment_methods

1. Schema Change
- Adds `cash_app_link` text column to `admin_payment_methods` table.
- Stores the clickable Cash App URL (e.g. https://cash.app/$yourname) that admins configure.
- The buy-bitcoin page will display this link alongside the $cashtag identifier.

2. Security
- No RLS changes needed — table already has RLS enabled with existing policies.
*/

ALTER TABLE admin_payment_methods ADD COLUMN IF NOT EXISTS cash_app_link text;
