INSERT INTO server_plans (server_id, plan)
SELECT id, 'premium' FROM servers
WHERE owner_id = 'd9b4298c-cdfa-4b83-8558-bcfb91953f61'
ON CONFLICT DO NOTHING;