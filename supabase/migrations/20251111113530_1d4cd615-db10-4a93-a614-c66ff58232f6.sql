-- Add RLS policy to allow first user insertion in user_roles
-- This allows the initial setup to create the first admin without requiring admin privileges

CREATE POLICY "Allow first user role creation"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1
    FROM public.user_roles
  )
  AND auth.uid() = user_id
);