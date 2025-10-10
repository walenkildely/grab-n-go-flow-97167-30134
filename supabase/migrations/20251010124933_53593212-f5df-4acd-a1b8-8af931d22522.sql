-- Allow users to insert their own employee record (for initial setup)
CREATE POLICY "Users can create own employee record"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);