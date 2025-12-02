-- Add admin role for the first user (bootstrap admin)
INSERT INTO public.user_roles (user_id, role)
VALUES ('d9b4298c-cdfa-4b83-8558-bcfb91953f61', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;