-- Allow admins to view all users
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any user
CREATE POLICY "Admins can update all users"
ON public.users
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));