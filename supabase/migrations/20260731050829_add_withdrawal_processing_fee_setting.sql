/*
# Add withdrawal processing fee setting

1. Adds a new platform_settings row for the mandatory withdrawal processing fee (20%).
2. Updates the existing withdrawal_tax_percent to 20 to match the new mandatory fee policy.
*/

INSERT INTO public.platform_settings (category, key_name, value, description)
VALUES ('fees', 'withdrawal_processing_fee_percent', '20', 'Mandatory withdrawal processing fee percentage')
ON CONFLICT DO NOTHING;

UPDATE public.platform_settings SET value = '20' WHERE category = 'fees' AND key_name = 'withdrawal_tax_percent';

NOTIFY pgrst, 'reload schema';
