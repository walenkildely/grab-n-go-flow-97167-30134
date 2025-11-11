import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { registerPushNotifications } from '@/lib/push';

export type UserRole = 'admin' | 'store' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  storeId?: string;
  managerId?: string;
  currentMonthPickups?: number;
  lastResetMonth?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  managerId: string;
  department: string;
  monthlyLimit: number;
  currentMonthPickups: number;
  lastResetMonth: string;
}

export interface Store {
  id: string;
  name: string;
  maxCapacity: number;
  location: string;
}

export interface PickupSchedule {
  id: string;
  employeeId: string;
  storeId: string;
  date: string;
  quantity: number;
  observations: string;
  token: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'pending';
  createdAt: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface StoreCapacity {
  storeId: string;
  date: string;
  maxCapacity: number;
  currentBookings: number;
}

export interface BlockedDate {
  date: string;
  reason?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  employees: Employee[];
  stores: Store[];
  pickupSchedules: PickupSchedule[];
  storeCapacities: StoreCapacity[];
  blockedDates: BlockedDate[];
  needsPasswordChange: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  addEmployee: (employee: Omit<Employee, 'id' | 'currentMonthPickups' | 'lastResetMonth'>) => Promise<void>;
  updateEmployee: (employeeId: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (employeeId: string) => Promise<void>;
  resetEmployeePassword: (employeeId: string, newPassword: string) => Promise<void>;
  addStore: (store: Omit<Store, 'id'> & { email?: string; password?: string }) => Promise<void>;
  updateStore: (storeId: string, updates: Partial<Store>) => Promise<void>;
  deleteStore: (storeId: string) => Promise<void>;
  resetStorePassword: (storeId: string, newPassword: string) => Promise<void>;
  schedulePickup: (pickup: Omit<PickupSchedule, 'id' | 'token' | 'createdAt' | 'status' | 'completedAt' | 'cancelledAt' | 'cancellationReason'>) => Promise<string>;

  getAvailableCapacity: (storeId: string, date: string) => number;
  updateStoreCapacity: (storeId: string, date: string, increment: number) => void;
  updateStoreMaxCapacity: (storeId: string, newCapacity: number) => void;
  updateStoreDateCapacity: (storeId: string, date: string, capacity: number) => void;
  blockDate: (date: string, reason?: string) => void;
  unblockDate: (date: string) => void;
  isDateBlocked: (date: string) => boolean;
  setNeedsPasswordChange: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [pickupSchedules, setPickupSchedules] = useState<PickupSchedule[]>([]);
  const [storeCapacities, setStoreCapacities] = useState<StoreCapacity[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setUser(null);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUserData(session.user.id);
      }
    });

    // Load blocked dates
    loadBlockedDates();

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      registerPushNotifications(user).catch(error => {
        console.error('Failed to register push notifications:', error);
      });
    }
  }, [user]);

  const loadUserData = async (userId: string) => {
    try {
      console.log('Loading user data for:', userId);
      
      // Get user roles
      const { data: rolesData, error: rolesError } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (rolesError) {
        console.error('Error loading roles:', rolesError);
        return;
      }

      if (!rolesData) {
        console.log('No role found for user');
        return;
      }

      const role = (rolesData as any).role as UserRole;
      console.log('User role:', role);

      // Get profile data
      const { data: profileData, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        return;
      }

      if (!profileData) {
        console.log('No profile found for user');
        return;
      }

      // Load pickup schedules from database
      const { data: pickupsData } = await (supabase as any).from('pickup_schedules').select('*');
      if (pickupsData) {
        const formattedPickups = pickupsData.map((pickup: any) => ({
          id: pickup.id,
          employeeId: pickup.employee_id,
          storeId: pickup.store_id,
          date: pickup.scheduled_date,
          quantity: pickup.quantity,
          observations: '',
          token: pickup.token,
          status: pickup.status as 'scheduled' | 'completed' | 'cancelled',
          createdAt: pickup.created_at,
          completedAt: pickup.completed_at || undefined,
          cancelledAt: pickup.cancelled_at || undefined,
          cancellationReason: pickup.cancellation_reason || undefined
        }));
        setPickupSchedules(formattedPickups);
      }

      // Based on role, load additional data
      if (role === 'employee') {
        const { data: employeeData, error: employeeError } = await (supabase as any)
          .from('employees')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('Employee data:', employeeData, 'Error:', employeeError);

        if (employeeData) {
          setUser({
            id: userId,
            name: employeeData.name,
            email: employeeData.email,
            role: 'employee',
            employeeId: employeeData.id,
            currentMonthPickups: employeeData.current_month_pickups || 0,
            lastResetMonth: employeeData.last_reset_month || ''
          });

          // Load all employees for the employee dashboard
          const { data: allEmployeesData } = await (supabase as any).from('employees').select('*');
          if (allEmployeesData) {
            const formattedEmployees = allEmployeesData.map(emp => ({
              id: emp.id,
              name: emp.name,
              email: emp.email,
              employeeId: emp.id, // Use UUID instead of CPF
              managerId: '',
              department: '',
              monthlyLimit: emp.monthly_limit,
              currentMonthPickups: emp.current_month_pickups,
              lastResetMonth: emp.last_reset_month || ''
            }));
            setEmployees(formattedEmployees);
          }

          // Load stores for employee to schedule pickups
          const { data: storesData } = await (supabase as any).from('stores').select('*');
          if (storesData) {
            const formattedStores = storesData.map(store => ({
              id: store.id,
              name: store.name,
              maxCapacity: store.max_daily_capacity,
              location: store.address
            }));
            setStores(formattedStores);
          }
        } else {
          console.error('No employee data found for user');
        }
      } else if (role === 'store') {
        const { data: storeData } = await (supabase as any)
          .from('stores')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (storeData) {
          setUser({
            id: userId,
            name: storeData.name,
            email: profileData.email,
            role: 'store',
            storeId: storeData.id
          });

          // Load all employees for store dashboard
          const { data: allEmployeesData } = await (supabase as any).from('employees').select('*');
          if (allEmployeesData) {
            const formattedEmployees = allEmployeesData.map(emp => ({
              id: emp.id,
              name: emp.name,
              email: emp.email,
              employeeId: emp.id,
              managerId: '',
              department: '',
              monthlyLimit: emp.monthly_limit,
              currentMonthPickups: emp.current_month_pickups,
              lastResetMonth: emp.last_reset_month || ''
            }));
            setEmployees(formattedEmployees);
          }
        }
      } else if (role === 'admin') {
        setUser({
          id: userId,
          name: profileData.full_name || 'Admin',
          email: profileData.email,
          role: 'admin'
        });

        // Load all employees for admin dashboard
        const { data: allEmployeesData } = await (supabase as any).from('employees').select('*');
        if (allEmployeesData) {
          const formattedEmployees = allEmployeesData.map(emp => ({
            id: emp.id,
            name: emp.name,
            email: emp.email,
            employeeId: emp.id,
            managerId: '',
            department: '',
            monthlyLimit: emp.monthly_limit,
            currentMonthPickups: emp.current_month_pickups,
            lastResetMonth: emp.last_reset_month || ''
          }));
          setEmployees(formattedEmployees);
        }

        // Load all stores for admin dashboard
        const { data: storesData } = await (supabase as any).from('stores').select('*');
        if (storesData) {
          const formattedStores = storesData.map(store => ({
            id: store.id,
            name: store.name,
            maxCapacity: store.max_daily_capacity,
            location: store.address
          }));
          setStores(formattedStores);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadBlockedDates = async () => {
    const { data } = await (supabase as any)
      .from('blocked_dates')
      .select('*');
    
    if (data) {
      setBlockedDates(data.map((d: any) => ({ date: d.date, reason: d.reason || undefined })));
    }
  };

  const checkAndResetMonthlyLimits = async () => {
    const currentMonth = new Date().toISOString().slice(0, 7);

    try {
      const { data: employeesData, error } = await (supabase as any)
        .from('employees')
        .select('*');

      if (error) {
        console.error('Error loading employees for reset:', error);
        return;
      }

      if (!employeesData) {
        setEmployees([]);
        return;
      }

      const employeesToReset = employeesData.filter((emp: any) => (emp.last_reset_month || '') !== currentMonth);

      if (employeesToReset.length > 0) {
        const { error: updateError } = await (supabase as any)
          .from('employees')
          .update({
            current_month_pickups: 0,
            last_reset_month: currentMonth
          })
          .in('id', employeesToReset.map((emp: any) => emp.id));

        if (updateError) {
          console.error('Error resetting monthly limits:', updateError);
        }
      }

      const formattedEmployees = employeesData.map((emp: any) => {
        const needsReset = (emp.last_reset_month || '') !== currentMonth;
        return {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          employeeId: emp.id,
          managerId: '',
          department: '',
          monthlyLimit: emp.monthly_limit,
          currentMonthPickups: needsReset ? 0 : emp.current_month_pickups,
          lastResetMonth: needsReset ? currentMonth : emp.last_reset_month || ''
        } as Employee;
      });

      setEmployees(formattedEmployees);

      if (user?.role === 'employee' && user.employeeId) {
        const updatedEmployee = formattedEmployees.find(emp => emp.id === user.employeeId || emp.employeeId === user.employeeId);
        if (updatedEmployee) {
          setUser(prev => prev ? {
            ...prev,
            currentMonthPickups: updatedEmployee.currentMonthPickups,
            lastResetMonth: updatedEmployee.lastResetMonth
          } : prev);
        }
      }
    } catch (err) {
      console.error('Unexpected error resetting monthly limits:', err);
    }
  };

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session?.user) {
        // Load user data immediately
        await loadUserData(data.session.user.id);
        
        // Check if user needs to change default password
        if (password === '123456') {
          setNeedsPasswordChange(true);
        }
      }

      return {};
    } catch (error) {
      return { error: 'Erro ao fazer login' };
    }
  };

  const signup = async (email: string, password: string, fullName: string, role: UserRole): Promise<{ error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        // Create role entry
        const { error: roleError } = await (supabase as any).from('user_roles').insert({
          user_id: data.user.id,
          role: role
        });

        if (roleError) {
          console.error('Error creating role:', roleError);
          return { error: 'Falha ao criar role do usuário: ' + roleError.message };
        }
      }

      return {};
    } catch (error) {
      return { error: 'Erro ao criar conta' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const addEmployee = async (employeeData: Omit<Employee, 'id' | 'currentMonthPickups' | 'lastResetMonth'>) => {
    try {
      console.log('Adding employee:', { name: employeeData.name, email: employeeData.email, cpf: employeeData.employeeId });
      
      // Call edge function to create user without affecting admin session
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: employeeData.email,
          password: '123456',
          full_name: employeeData.name,
          role: 'employee',
          metadata: {
            name: employeeData.name,
            email: employeeData.email,
            cpf: employeeData.employeeId,
            monthly_limit: employeeData.monthlyLimit
          }
        }
      });

      console.log('Edge function response:', response);

      if (response.error) {
        console.error('Error calling create-user for employee:', response.error);
        
        // Try to get the error from the response data
        const errorData = response.data;
        const errorMessage = errorData?.error || errorData?.details || response.error.message || JSON.stringify(response.error);
        
        console.log('Extracted error message:', errorMessage);
        
        if (errorMessage.includes('email address has already been registered') || errorMessage.includes('email_exists') || errorMessage.includes('Já existe um usuário cadastrado com este email')) {
          throw new Error('Já existe um usuário cadastrado com este email');
        }
        
        if (errorMessage.includes('CPF')) {
          throw new Error(errorMessage);
        }
        
        throw new Error('Falha ao criar funcionário: ' + errorMessage);
      }

      console.log('Employee created successfully via edge function:', response.data);

      // Reload employees
      const { data: employeesData } = await (supabase as any).from('employees').select('*');
      if (employeesData) {
        const formattedEmployees = employeesData.map((emp: any) => ({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          employeeId: emp.cpf,
          managerId: '',
          department: employeeData.department || '',
          monthlyLimit: emp.monthly_limit,
          currentMonthPickups: emp.current_month_pickups,
          lastResetMonth: emp.last_reset_month || ''
        }));
        setEmployees(formattedEmployees);
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      throw error;
    }
  };

  const updateEmployee = async (employeeId: string, updates: Partial<Employee>) => {
    try {
      // Update employee record in database
      const { error: updateError } = await (supabase as any)
        .from('employees')
        .update({
          name: updates.name,
          email: updates.email,
          cpf: updates.employeeId,
          monthly_limit: updates.monthlyLimit
        })
        .eq('id', employeeId);

      if (updateError) {
        console.error('Error updating employee:', updateError);
        throw new Error('Falha ao atualizar funcionário: ' + updateError.message);
      }

      // Reload employees
      const { data: employeesData } = await (supabase as any).from('employees').select('*');
      if (employeesData) {
        const formattedEmployees = employeesData.map((emp: any) => ({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          employeeId: emp.id,
          managerId: '',
          department: '',
          monthlyLimit: emp.monthly_limit,
          currentMonthPickups: emp.current_month_pickups,
          lastResetMonth: emp.last_reset_month || ''
        }));
        setEmployees(formattedEmployees);
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  };

  const deleteEmployee = async (employeeId: string) => {
    try {
      // Get employee to find user_id
      const { data: empData } = await (supabase as any)
        .from('employees')
        .select('user_id')
        .eq('id', employeeId)
        .single();

      if (!empData) {
        throw new Error('Funcionário não encontrado');
      }

      const userId = empData.user_id;

      // Call edge function to delete user completely
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: {
          user_id: userId,
          role: 'employee'
        }
      });

      if (error) {
        console.error('Error calling delete-user function:', error);
        throw new Error('Falha ao deletar funcionário: ' + error.message);
      }

      console.log('Employee deleted successfully:', data);

      // Reload employees
      const { data: employeesData } = await (supabase as any).from('employees').select('*');
      if (employeesData) {
        const formattedEmployees = employeesData.map((emp: any) => ({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          employeeId: emp.id,
          managerId: '',
          department: '',
          monthlyLimit: emp.monthly_limit,
          currentMonthPickups: emp.current_month_pickups,
          lastResetMonth: emp.last_reset_month || ''
        }));
        setEmployees(formattedEmployees);
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  };

  const resetEmployeePassword = async (employeeId: string, newPassword: string) => {
    try {
      // Get employee user_id
      const { data: empData } = await (supabase as any)
        .from('employees')
        .select('user_id, email')
        .eq('id', employeeId)
        .single();

      if (!empData || !empData.user_id) {
        throw new Error('Funcionário não possui usuário associado');
      }

      // Note: Supabase doesn't allow direct password reset from client
      // You would need an edge function with admin privileges for this
      // For now, we'll throw an informative error
      throw new Error('Reset de senha deve ser feito através de um link enviado por email. Use a função "Esqueci minha senha" no login.');
    } catch (error) {
      console.error('Error resetting employee password:', error);
      throw error;
    }
  };

  const updateStore = async (storeId: string, updates: Partial<Store>) => {
    try {
      // Update store record in database
      const { error: updateError } = await (supabase as any)
        .from('stores')
        .update({
          name: updates.name,
          address: updates.location,
          max_daily_capacity: updates.maxCapacity
        })
        .eq('id', storeId);

      if (updateError) {
        console.error('Error updating store:', updateError);
        throw new Error('Falha ao atualizar loja: ' + updateError.message);
      }

      // Reload stores
      const { data: storesData } = await (supabase as any).from('stores').select('*');
      if (storesData) {
        const formattedStores = storesData.map((store: any) => ({
          id: store.id,
          name: store.name,
          maxCapacity: store.max_daily_capacity,
          location: store.address
        }));
        setStores(formattedStores);
      }
    } catch (error) {
      console.error('Error updating store:', error);
      throw error;
    }
  };

  const deleteStore = async (storeId: string) => {
    try {
      // Get store user_id
      const { data: storeData } = await (supabase as any)
        .from('stores')
        .select('user_id')
        .eq('id', storeId)
        .single();

      if (!storeData) {
        throw new Error('Loja não encontrada');
      }

      const userId = storeData.user_id;

      // If store has user, call edge function to delete user completely
      if (userId) {
        const { data, error } = await supabase.functions.invoke('delete-user', {
          body: {
            user_id: userId,
            role: 'store'
          }
        });

        if (error) {
          console.error('Error calling delete-user function:', error);
          throw new Error('Falha ao deletar loja: ' + error.message);
        }

        console.log('Store deleted successfully:', data);
      } else {
        // If no user associated, just delete the store record
        await (supabase as any)
          .from('pickup_schedules')
          .delete()
          .eq('store_id', storeId);

        await (supabase as any)
          .from('store_capacities')
          .delete()
          .eq('store_id', storeId);

        const { error: deleteError } = await (supabase as any)
          .from('stores')
          .delete()
          .eq('id', storeId);

        if (deleteError) {
          console.error('Error deleting store:', deleteError);
          throw new Error('Falha ao deletar loja: ' + deleteError.message);
        }
      }

      // Reload stores
      const { data: storesData } = await (supabase as any).from('stores').select('*');
      if (storesData) {
        const formattedStores = storesData.map((store: any) => ({
          id: store.id,
          name: store.name,
          maxCapacity: store.max_daily_capacity,
          location: store.address
        }));
        setStores(formattedStores);
      }
    } catch (error) {
      console.error('Error deleting store:', error);
      throw error;
    }
  };

  const resetStorePassword = async (storeId: string, newPassword: string) => {
    try {
      // Get store user_id
      const { data: storeData } = await (supabase as any)
        .from('stores')
        .select('user_id')
        .eq('id', storeId)
        .single();

      if (!storeData || !storeData.user_id) {
        throw new Error('Loja não possui usuário associado');
      }

      // Note: Same limitation as employee password reset
      throw new Error('Reset de senha deve ser feito através de um link enviado por email. Use a função "Esqueci minha senha" no login.');
    } catch (error) {
      console.error('Error resetting store password:', error);
      throw error;
    }
  };

  const addStore = async (storeData: Omit<Store, 'id'> & { email?: string; password?: string }) => {
    try {
      console.log('Adding store:', { name: storeData.name, hasEmail: !!storeData.email, hasPassword: !!storeData.password });
      
      // If email and password provided, create user account via edge function
      if (storeData.email && storeData.password) {
        console.log('Creating store with user account via edge function');
        
        const response = await supabase.functions.invoke('create-user', {
          body: {
            email: storeData.email,
            password: storeData.password,
            full_name: storeData.name,
            role: 'store',
            metadata: {
              name: storeData.name,
              address: storeData.location,
              max_daily_capacity: storeData.maxCapacity
            }
          }
        });

        console.log('Edge function response:', response);

        if (response.error) {
          console.error('Error calling create-user for store:', response.error);
          
          // Try to get the error from the response data
          const errorData = response.data;
          const errorMessage = errorData?.error || errorData?.details || response.error.message || JSON.stringify(response.error);
          
          console.log('Extracted error message:', errorMessage);
          
          if (errorMessage.includes('email address has already been registered') || errorMessage.includes('email_exists') || errorMessage.includes('Já existe um usuário cadastrado com este email')) {
            throw new Error('Já existe um usuário cadastrado com este email');
          }
          
          throw new Error('Falha ao criar loja: ' + errorMessage);
        }

        console.log('Store created successfully via edge function:', response.data);
      } else {
        console.log('Creating store without user account');
        
        // Create store without user
        const { error: storeError } = await (supabase as any).from('stores').insert({
          name: storeData.name,
          address: storeData.location,
          max_daily_capacity: storeData.maxCapacity
        });

        if (storeError) {
          console.error('Error creating store record:', storeError);
          throw new Error('Falha ao criar registro da loja: ' + storeError.message);
        }

        console.log('Created store record without user');
      }

      // Reload stores
      const { data: storesData } = await (supabase as any).from('stores').select('*');
      if (storesData) {
        const formattedStores = storesData.map((store: any) => ({
          id: store.id,
          name: store.name,
          maxCapacity: store.max_daily_capacity,
          location: store.address
        }));
        setStores(formattedStores);
      }
    } catch (error) {
      console.error('Error adding store:', error);
      throw error;
    }
  };

  const generateToken = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const getAvailableCapacity = (storeId: string, date: string): number => {
    const store = stores.find(s => s.id === storeId);
    if (!store) return 0;

    const dateCapacity = storeCapacities.find(c => c.storeId === storeId && c.date === date);
    const currentBookings = dateCapacity?.currentBookings || 0;
    // Use date-specific capacity if set, otherwise use store default
    const maxCapacity = dateCapacity?.maxCapacity || store.maxCapacity;
    return maxCapacity - currentBookings;
  };

  const updateStoreCapacity = (storeId: string, date: string, increment: number) => {
    const existingCapacity = storeCapacities.find(c => c.storeId === storeId && c.date === date);
    
    if (existingCapacity) {
      const updatedCapacities = storeCapacities.map(c =>
        c.storeId === storeId && c.date === date
          ? { ...c, currentBookings: Math.max(0, c.currentBookings + increment) }
          : c
      );
      setStoreCapacities(updatedCapacities);
      localStorage.setItem('storeCapacities', JSON.stringify(updatedCapacities));
    } else {
      const store = stores.find(s => s.id === storeId);
      if (store) {
        const newCapacity: StoreCapacity = {
          storeId,
          date,
          maxCapacity: store.maxCapacity,
          currentBookings: Math.max(0, increment)
        };
        const updatedCapacities = [...storeCapacities, newCapacity];
        setStoreCapacities(updatedCapacities);
        localStorage.setItem('storeCapacities', JSON.stringify(updatedCapacities));
      }
    }
  };

  const schedulePickup = async (pickupData: Omit<PickupSchedule, 'id' | 'token' | 'createdAt' | 'status' | 'completedAt' | 'cancelledAt' | 'cancellationReason'>): Promise<string> => {
    const token = generateToken();
    
    try {
      // Save to database first
      const { error: insertError } = await (supabase as any).from('pickup_schedules').insert({
        employee_id: pickupData.employeeId,
        store_id: pickupData.storeId,
        scheduled_date: pickupData.date,
        quantity: pickupData.quantity,
        token: token,
        status: 'scheduled'
      });

      if (insertError) {
        console.error('Error saving pickup:', insertError);
        throw insertError;
      }

      console.log('Pickup saved successfully');

      await updateEmployeePickupCount(pickupData.employeeId, pickupData.quantity);

      // Reload pickups from database
      const { data: pickupsData } = await (supabase as any)
        .from('pickup_schedules')
        .select('*')
        .order('scheduled_date', { ascending: false });

      if (pickupsData) {
        const formattedPickups: PickupSchedule[] = pickupsData.map((pickup: any) => ({
          id: pickup.id,
          employeeId: pickup.employee_id,
          storeId: pickup.store_id,
          date: pickup.scheduled_date,
          quantity: pickup.quantity,
          observations: '',
          token: pickup.token,
          status: pickup.status as 'scheduled' | 'completed' | 'cancelled' | 'pending',
          createdAt: pickup.created_at,
          completedAt: pickup.completed_at || undefined,
          cancelledAt: pickup.cancelled_at || undefined,
          cancellationReason: pickup.cancellation_reason || undefined
        }));
        setPickupSchedules(formattedPickups);
      }

      const employeeRecord = employees.find(emp => emp.id === pickupData.employeeId || emp.employeeId === pickupData.employeeId);

      try {
        const { error: notificationError } = await supabase.functions.invoke('notify-store-pickup', {
          body: {
            storeId: pickupData.storeId,
            pickupToken: token,
            pickupDate: pickupData.date,
            quantity: pickupData.quantity,
            employeeName: employeeRecord?.name,
          }
        });

        if (notificationError) {
          console.error('Error sending push notification to store:', notificationError);
        }
      } catch (error) {
        console.error('Unexpected error invoking notify-store-pickup function:', error);
      }

      console.log('Pickup scheduled successfully, returning token:', token);
      return token;
    } catch (error) {
      console.error('Error scheduling pickup:', error);
      throw error;
    }
  };

  const confirmPickup = async (token: string): Promise<boolean> => {
    const pickup = pickupSchedules.find(p => p.token === token && (p.status === 'scheduled' || (p.status as any) === 'pending'));
    if (!pickup) {
      return false;
    }

    const previousState = pickupSchedules;
    const updatedPickups = pickupSchedules.map(p =>
      p.token === token
        ? { ...p, status: 'completed' as const, completedAt: new Date().toISOString() }
        : p
    );
    setPickupSchedules(updatedPickups);

    try {
      const { error } = await (supabase as any)
        .from('pickup_schedules')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('token', token);

      if (error) {
        console.error('Error confirming pickup:', error);
        setPickupSchedules(previousState);
        return false;
      }

      const { data: pickupsData } = await (supabase as any).from('pickup_schedules').select('*');
      if (pickupsData) {
        const formattedPickups = pickupsData.map((p: any) => ({
          id: p.id,
          employeeId: p.employee_id,
          storeId: p.store_id,
          date: p.scheduled_date,
          quantity: p.quantity,
          observations: '',
          token: p.token,
          status: p.status as 'scheduled' | 'completed' | 'cancelled',
          createdAt: p.created_at,
          completedAt: p.completed_at || undefined,
          cancelledAt: p.cancelled_at || undefined,
          cancellationReason: p.cancellation_reason || undefined
        }));
        setPickupSchedules(formattedPickups);
      }

      const store = stores.find(s => s.id === pickup.storeId);

      try {
        const { error: notificationError } = await supabase.functions.invoke('notify-employee-pickup', {
          body: {
            employeeId: pickup.employeeId,
            status: 'completed',
            token,
            storeName: store?.name,
            pickupDate: pickup.date || pickup.createdAt,
          }
        });

        if (notificationError) {
          console.error('Error sending confirmation push notification:', notificationError);
        }
      } catch (notificationError) {
        console.error('Unexpected error invoking notify-employee-pickup function:', notificationError);
      }

      return true;
    } catch (error) {
      console.error('Error confirming pickup:', error);
      setPickupSchedules(previousState);
      return false;
    }
  };

  const updateEmployeePickupCount = async (employeeId: string, quantity: number) => {
    const currentMonth = new Date().toISOString().slice(0, 7);

    try {
      const { data: employeeData, error } = await (supabase as any)
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .maybeSingle();

      if (error) {
        console.error('Error loading employee for pickup update:', error);
        return;
      }

      if (!employeeData) {
        console.warn('Employee not found for pickup update:', employeeId);
        return;
      }

      let lastResetMonth = employeeData.last_reset_month || '';
      let currentMonthPickups = employeeData.current_month_pickups || 0;

      if (lastResetMonth !== currentMonth) {
        currentMonthPickups = 0;
        lastResetMonth = currentMonth;
      }

      const newCount = Math.max(0, currentMonthPickups + quantity);

      const { data: updatedEmployeeData, error: updateError } = await (supabase as any)
        .from('employees')
        .update({
          current_month_pickups: newCount,
          last_reset_month: lastResetMonth
        })
        .eq('id', employeeId)
        .select('*')
        .maybeSingle();

      if (updateError) {
        console.error('Error updating employee pickup count:', updateError);
        return;
      }

      if (!updatedEmployeeData) {
        return;
      }

      const formattedEmployee: Employee = {
        id: updatedEmployeeData.id,
        name: updatedEmployeeData.name,
        email: updatedEmployeeData.email,
        employeeId: updatedEmployeeData.id,
        managerId: '',
        department: '',
        monthlyLimit: updatedEmployeeData.monthly_limit,
        currentMonthPickups: updatedEmployeeData.current_month_pickups,
        lastResetMonth: updatedEmployeeData.last_reset_month || ''
      };

      setEmployees(prev => {
        const exists = prev.some(emp => emp.id === employeeId || emp.employeeId === employeeId);
        if (exists) {
          return prev.map(emp =>
            emp.id === employeeId || emp.employeeId === employeeId
              ? formattedEmployee
              : emp
          );
        }
        return [...prev, formattedEmployee];
      });

      if (user?.role === 'employee' && user.employeeId === employeeId) {
        setUser(prev => prev ? {
          ...prev,
          currentMonthPickups: formattedEmployee.currentMonthPickups,
          lastResetMonth: formattedEmployee.lastResetMonth
        } : prev);
      }
    } catch (err) {
      console.error('Unexpected error updating pickup count:', err);
    }
  };



    const previousState = pickupSchedules;
    const updatedPickups = pickupSchedules.map(p =>
      p.token === token
        ? {
            ...p,
            status: 'cancelled' as const,
            cancelledAt: new Date().toISOString(),
            cancellationReason: reason
          }
        : p
    );
    setPickupSchedules(updatedPickups);

    updateEmployeePickupCount(pickup.employeeId, -pickup.quantity);

    try {
      const { error } = await (supabase as any)
        .from('pickup_schedules')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason
        })
        .eq('token', token);

      if (error) {
        console.error('Error cancelling pickup:', error);
        setPickupSchedules(previousState);
        updateEmployeePickupCount(pickup.employeeId, pickup.quantity);
        return false;
      }

      const { data: pickupsData } = await (supabase as any).from('pickup_schedules').select('*');
      if (pickupsData) {
        const formattedPickups = pickupsData.map((p: any) => ({
          id: p.id,
          employeeId: p.employee_id,
          storeId: p.store_id,
          date: p.scheduled_date,
          quantity: p.quantity,
          observations: '',
          token: p.token,
          status: p.status as 'scheduled' | 'completed' | 'cancelled',
          createdAt: p.created_at,
          completedAt: p.completed_at || undefined,
          cancelledAt: p.cancelled_at || undefined,
          cancellationReason: p.cancellation_reason || undefined
        }));
        setPickupSchedules(formattedPickups);
      }

      const store = stores.find(s => s.id === pickup.storeId);

      try {
        const { error: notificationError } = await supabase.functions.invoke('notify-employee-pickup', {
          body: {
            employeeId: pickup.employeeId,
            status: 'cancelled',
            token,
            storeName: store?.name,
            pickupDate: pickup.date || pickup.createdAt,
            reason,
          }
        });

        if (notificationError) {
          console.error('Error sending cancellation push notification:', notificationError);
        }
      } catch (notificationError) {
        console.error('Unexpected error invoking notify-employee-pickup function:', notificationError);
      }

      return true;
    } catch (error) {
      console.error('Error cancelling pickup:', error);
      setPickupSchedules(previousState);
      updateEmployeePickupCount(pickup.employeeId, pickup.quantity);
      return false;
    }
  };

  const resetMonthlyLimits = () => {
    return checkAndResetMonthlyLimits();
  };

  const updateStoreMaxCapacity = (storeId: string, newCapacity: number) => {
    const updatedStores = stores.map(store => 
      store.id === storeId 
        ? { ...store, maxCapacity: newCapacity }
        : store
    );
    
    setStores(updatedStores);
    localStorage.setItem('stores', JSON.stringify(updatedStores));
  };

  const updateStoreDateCapacity = (storeId: string, date: string, capacity: number) => {
    const existingCapacity = storeCapacities.find(c => c.storeId === storeId && c.date === date);
    
    if (existingCapacity) {
      const updatedCapacities = storeCapacities.map(c =>
        c.storeId === storeId && c.date === date
          ? { ...c, maxCapacity: capacity }
          : c
      );
      setStoreCapacities(updatedCapacities);
      localStorage.setItem('storeCapacities', JSON.stringify(updatedCapacities));
    } else {
      const newCapacity: StoreCapacity = {
        storeId,
        date,
        maxCapacity: capacity,
        currentBookings: 0
      };
      const updatedCapacities = [...storeCapacities, newCapacity];
      setStoreCapacities(updatedCapacities);
      localStorage.setItem('storeCapacities', JSON.stringify(updatedCapacities));
    }
  };

  const blockDate = async (date: string, reason?: string) => {
    await (supabase as any).from('blocked_dates').insert({ date, reason });
    loadBlockedDates();
  };

  const unblockDate = async (date: string) => {
    await (supabase as any).from('blocked_dates').delete().eq('date', date);
    loadBlockedDates();
  };

  const isDateBlocked = (date: string): boolean => {
    return blockedDates.some(bd => bd.date === date);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      employees,
      stores,
      pickupSchedules,
      storeCapacities,
      blockedDates,
      needsPasswordChange,
      login,
      signup,
      logout,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      resetEmployeePassword,
      addStore,
      updateStore,
      deleteStore,
      resetStorePassword,
      schedulePickup,
      confirmPickup,
      cancelPickup,
      updateEmployeePickupCount,
      resetMonthlyLimits,
      getAvailableCapacity,
      updateStoreCapacity,
      updateStoreMaxCapacity,
      updateStoreDateCapacity,
      blockDate,
      unblockDate,
      isDateBlocked,
      setNeedsPasswordChange
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};