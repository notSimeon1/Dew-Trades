/*
# Add account_mode column to transactions table

## Changes
1. Adds `account_mode` (text, default 'demo') to transactions table
   - Allows filtering transactions by demo/live mode
*/

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_mode text DEFAULT 'demo';
