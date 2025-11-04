import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'store' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  storeId?: string;
  managerId?: string;
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
  status: 'scheduled' | 'completed' | 'cancelled';
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
  schedulePickup: (pickup: Omit<PickupSchedule, 'id' | 'token' | 'createdAt' | 'status' | 'completedAt' | 'cancelledAt' | 'cancellationReason'>) => string;
  confirmPickup: (token: string) => boolean;
  cancelPickup: (token: string, reason: string) => boolean;
  updateEmployeePickupCount: (employeeId: string, quantity: number) => void;
  resetMonthlyLimits: () => void;
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
            employeeId: employeeData.id
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

  const checkAndResetMonthlyLimits = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const savedEmployees = localStorage.getItem('employees');
    const employeeList = savedEmployees ? JSON.parse(savedEmployees) : [];
    
    const updatedEmployees = employeeList.map((emp: Employee) => {
      if (emp.lastResetMonth !== currentMonth) {
        return {
          ...emp,
          currentMonthPickups: 0,
          lastResetMonth: currentMonth
        };
      }
      return emp;
    });

    setEmployees(updatedEmployees);
    localStorage.setItem('employees', JSON.stringify(updatedEmployees));
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
        await (supabase as any).from('user_roles').insert({
          user_id: data.user.id,
          role: role
        });
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
      // Call edge function to create user without affecting admin session
      const { data, error } = await supabase.functions.invoke('create-user', {
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

      if (error) {
        console.error('Error creating employee:', error);
        throw new Error('Falha ao criar funcionário: ' + error.message);
      }

      console.log('Employee created successfully:', data);

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

      // Delete employee record (this will cascade delete user via FK)
      const { error: deleteError } = await (supabase as any)
        .from('employees')
        .delete()
        .eq('id', employeeId);

      if (deleteError) {
        console.error('Error deleting employee:', deleteError);
        throw new Error('Falha ao deletar funcionário: ' + deleteError.message);
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
      // Delete store record
      const { error: deleteError } = await (supabase as any)
        .from('stores')
        .delete()
        .eq('id', storeId);

      if (deleteError) {
        console.error('Error deleting store:', deleteError);
        throw new Error('Falha ao deletar loja: ' + deleteError.message);
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
      // If email and password provided, create user account via edge function
      if (storeData.email && storeData.password) {
        const { data, error } = await supabase.functions.invoke('create-user', {
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

        if (error) {
          console.error('Error creating store:', error);
          throw new Error('Falha ao criar loja: ' + error.message);
        }

        console.log('Store created successfully:', data);
      } else {
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

        console.log('Created store record');
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
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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

  const schedulePickup = (pickupData: Omit<PickupSchedule, 'id' | 'token' | 'createdAt' | 'status' | 'completedAt' | 'cancelledAt' | 'cancellationReason'>): string => {
    const token = generateToken();
    
    // Save to database
    ((supabase as any).from('pickup_schedules').insert({
      employee_id: pickupData.employeeId,
      store_id: pickupData.storeId,
      scheduled_date: pickupData.date,
      quantity: pickupData.quantity,
      token: token,
      status: 'pending'
    }) as any).then(({ data, error }: any) => {
      if (error) {
        console.error('Error saving pickup:', error);
      } else {
        // Reload pickups after successful save
        loadUserData(user?.id || '');
      }
    });

    // Update employee pickup count in database
    updateEmployeePickupCount(pickupData.employeeId, pickupData.quantity);
    
    return token;
  };

  const confirmPickup = (token: string): boolean => {
    const pickup = pickupSchedules.find(p => p.token === token && (p.status === 'scheduled' || p.status as any === 'pending'));
    if (pickup) {
      // Update in database
      ((supabase as any).from('pickup_schedules')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('token', token) as any)
        .then(({ error }: any) => {
          if (error) {
            console.error('Error confirming pickup:', error);
          } else {
            // Reload data to reflect changes
            loadUserData(user?.id || '');
          }
        });

      // Update local state immediately for UI responsiveness
      const updatedPickups = pickupSchedules.map(p => 
        p.token === token 
          ? { ...p, status: 'completed' as const, completedAt: new Date().toISOString() }
          : p
      );
      setPickupSchedules(updatedPickups);
      
      return true;
    }
    return false;
  };

  const updateEmployeePickupCount = (employeeId: string, quantity: number) => {
    // Update in database
    const employee = employees.find(emp => emp.employeeId === employeeId);
    if (employee) {
      const newCount = employee.currentMonthPickups + quantity;
      ((supabase as any).from('employees')
        .update({ 
          current_month_pickups: newCount
        })
        .eq('id', employeeId) as any)
        .then(({ error }: any) => {
          if (error) {
            console.error('Error updating employee pickup count:', error);
          } else {
            // Reload employees to reflect changes
            loadUserData(user?.id || '');
          }
        });

      // Update local state immediately for UI responsiveness
      const updatedEmployees = employees.map(emp => 
        emp.employeeId === employeeId 
          ? { ...emp, currentMonthPickups: newCount }
          : emp
      );
      setEmployees(updatedEmployees);
    }
  };

  const cancelPickup = (token: string, reason: string): boolean => {
    const pickup = pickupSchedules.find(p => p.token === token && (p.status === 'scheduled' || p.status as any === 'pending'));
    if (pickup) {
      // Update in database
      ((supabase as any).from('pickup_schedules')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason
        })
        .eq('token', token) as any)
        .then(({ error }: any) => {
          if (error) {
            console.error('Error cancelling pickup:', error);
          } else {
            // Reload data to reflect changes
            loadUserData(user?.id || '');
          }
        });

      // Update local state immediately
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
      
      // Restore employee available quantity
      updateEmployeePickupCount(pickup.employeeId, -pickup.quantity);
      
      return true;
    }
    return false;
  };

  const resetMonthlyLimits = () => {
    checkAndResetMonthlyLimits();
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