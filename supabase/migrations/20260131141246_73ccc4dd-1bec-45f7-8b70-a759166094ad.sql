-- Create view for current token allowance with calculated credits
CREATE OR REPLACE VIEW public.v_server_token_allowance_current AS
SELECT 
    sta.id,
    sta.server_id,
    sta.tokens_granted,
    sta.tokens_used,
    (sta.tokens_granted - sta.tokens_used) AS remaining_tokens,
    acs.value_int AS tokens_per_credit,
    (sta.tokens_granted / acs.value_int) AS credits_granted,
    (sta.tokens_used / acs.value_int) AS credits_used,
    ((sta.tokens_granted - sta.tokens_used) / acs.value_int) AS remaining_credits,
    sta.period_start,
    sta.period_end,
    sta.source,
    sta.metadata,
    sta.created_at,
    sta.updated_at
FROM public.server_token_allowances sta
CROSS JOIN public.ai_credit_settings acs
WHERE acs.key = 'tokens_per_credit'
  AND now() >= sta.period_start 
  AND now() < sta.period_end;

-- Enable RLS on the view (views inherit from underlying tables, but we add explicit policies)
ALTER VIEW public.v_server_token_allowance_current SET (security_invoker = on);

-- Note: Since we enabled security_invoker, the view will use the RLS policies 
-- from the underlying server_token_allowances table, which already has:
-- - Users can view via user_servers
-- - Server owners can view their servers
-- - Admins can view all