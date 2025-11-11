-- Fix infinite recursion in RLS policies by using security definer functions

-- Drop problematic policies
DROP POLICY IF EXISTS "Stores can view employees with pickups at their store" ON public.employees;
DROP POLICY IF EXISTS "Employees can view own pickups" ON public.pickup_schedules;
DROP POLICY IF EXISTS "Stores can view their pickups" ON public.pickup_schedules;
DROP POLICY IF EXISTS "Stores can update their pickups" ON public.pickup_schedules;

-- Create security definer function to check if user is a store with pickups from employee
CREATE OR REPLACE FUNCTION public.is_store_with_employee_pickup(_employee_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    INNER JOIN public.pickup_schedules ps ON s.id = ps.store_id
    WHERE s.user_id = _user_id
      AND ps.employee_id = _employee_id
  )
$$;

-- Create security definer function to check if user is employee with pickup
CREATE OR REPLACE FUNCTION public.is_employee_with_pickup(_pickup_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    INNER JOIN public.pickup_schedules ps ON e.id = ps.employee_id
    WHERE ps.id = _pickup_id
      AND e.user_id = _user_id
  )
$$;

-- Create security definer function to check if user is store with pickup
CREATE OR REPLACE FUNCTION public.is_store_with_pickup(_pickup_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    INNER JOIN public.pickup_schedules ps ON s.id = ps.store_id
    WHERE ps.id = _pickup_id
      AND s.user_id = _user_id
  )
$$;

-- Recreate policies using security definer functions
CREATE POLICY "Stores can view employees with pickups at their store"
ON public.employees
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  auth.uid() = user_id OR
  public.is_store_with_employee_pickup(id, auth.uid())
);

CREATE POLICY "Employees can view own pickups"
ON public.pickup_schedules
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.is_employee_with_pickup(id, auth.uid())
);

CREATE POLICY "Stores can view their pickups"
ON public.pickup_schedules
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.is_store_with_pickup(id, auth.uid())
);

CREATE POLICY "Stores can update their pickups"
ON public.pickup_schedules
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.is_store_with_pickup(id, auth.uid())
);