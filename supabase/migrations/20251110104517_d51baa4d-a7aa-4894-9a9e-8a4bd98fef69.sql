-- Allow stores to view employee data for pickups at their store
CREATE POLICY "Stores can view employees with pickups at their store"
ON public.employees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.pickup_schedules ps
    INNER JOIN public.stores s ON s.id = ps.store_id
    WHERE ps.employee_id = employees.id
    AND s.user_id = auth.uid()
  )
);