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
  addStore: (store: Omit<Store, 'id'>) => void;
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
      // Get user roles
      const { data: rolesData, error: rolesError } = await supabase
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

      const role = rolesData.role as UserRole;

      // Get profile data
      const { data: profileData, error: profileError } = await supabase
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

      // Based on role, load additional data
      if (role === 'employee') {
        const { data: employeeData } = await supabase
          .from('employees')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (employeeData) {
          setUser({
            id: userId,
            name: employeeData.name,
            email: employeeData.email,
            role: 'employee',
            employeeId: employeeData.id
          });
        }
      } else if (role === 'store') {
        const { data: storeData } = await supabase
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
        }
      } else if (role === 'admin') {
        setUser({
          id: userId,
          name: profileData.full_name || 'Admin',
          email: profileData.email,
          role: 'admin'
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadBlockedDates = async () => {
    const { data } = await supabase
      .from('blocked_dates')
      .select('*');
    
    if (data) {
      setBlockedDates(data.map(d => ({ date: d.date, reason: d.reason || undefined })));
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { error: error.message };
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
        await supabase.from('user_roles').insert({
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
      // Create user with default password "1234"
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: employeeData.email,
        password: '1234',
        options: {
          data: {
            full_name: employeeData.name
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (signupError) {
        throw signupError;
      }

      if (authData.user) {
        // Create role entry for employee
        await supabase.from('user_roles').insert({
          user_id: authData.user.id,
          role: 'employee'
        });

        // Create employee record
        await supabase.from('employees').insert({
          user_id: authData.user.id,
          name: employeeData.name,
          email: employeeData.email,
          cpf: employeeData.employeeId,
          monthly_limit: employeeData.monthlyLimit,
          current_month_pickups: 0,
          last_reset_month: new Date().toISOString().slice(0, 7)
        });

        // Reload employees
        const { data: employeesData } = await supabase.from('employees').select('*');
        if (employeesData) {
          const formattedEmployees = employeesData.map(emp => ({
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
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      throw error;
    }
  };

  const addStore = (storeData: Omit<Store, 'id'>) => {
    const newStore: Store = {
      ...storeData,
      id: Date.now().toString()
    };
    
    const updatedStores = [...stores, newStore];
    setStores(updatedStores);
    localStorage.setItem('stores', JSON.stringify(updatedStores));
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
    const newPickup: PickupSchedule = {
      ...pickupData,
      id: Date.now().toString(),
      token,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };
    
    const updatedPickups = [...pickupSchedules, newPickup];
    setPickupSchedules(updatedPickups);
    localStorage.setItem('pickupSchedules', JSON.stringify(updatedPickups));
    
    // Update store capacity
    updateStoreCapacity(pickupData.storeId, pickupData.date, 1);
    
    // Reduce employee available quantity immediately when scheduled
    updateEmployeePickupCount(pickupData.employeeId, pickupData.quantity);
    
    return token;
  };

  const confirmPickup = (token: string): boolean => {
    const pickup = pickupSchedules.find(p => p.token === token && p.status === 'scheduled');
    if (pickup) {
      const updatedPickups = pickupSchedules.map(p => 
        p.token === token 
          ? { ...p, status: 'completed' as const, completedAt: new Date().toISOString() }
          : p
      );
      
      setPickupSchedules(updatedPickups);
      localStorage.setItem('pickupSchedules', JSON.stringify(updatedPickups));
      
      // Employee quantity was already updated during scheduling, no need to update again
      return true;
    }
    return false;
  };

  const updateEmployeePickupCount = (employeeId: string, quantity: number) => {
    const updatedEmployees = employees.map(emp => 
      emp.employeeId === employeeId 
        ? { ...emp, currentMonthPickups: emp.currentMonthPickups + quantity }
        : emp
    );
    
    setEmployees(updatedEmployees);
    localStorage.setItem('employees', JSON.stringify(updatedEmployees));
  };

  const cancelPickup = (token: string, reason: string): boolean => {
    const pickup = pickupSchedules.find(p => p.token === token && p.status === 'scheduled');
    if (pickup) {
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
      localStorage.setItem('pickupSchedules', JSON.stringify(updatedPickups));
      
      // Release store capacity
      updateStoreCapacity(pickup.storeId, pickup.date, -1);
      
      // Restore employee available quantity
      updateEmployeePickupCount(pickup.employeeId, -pickup.quantity);
      
      // Show notification to employee (in real app, this would be an email/push notification)
      const employee = employees.find(e => e.employeeId === pickup.employeeId);
      if (employee) {
        alert(`Retirada cancelada para ${employee.name}. Motivo: ${reason}`);
      }
      
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
    await supabase.from('blocked_dates').insert({ date, reason });
    loadBlockedDates();
  };

  const unblockDate = async (date: string) => {
    await supabase.from('blocked_dates').delete().eq('date', date);
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
      addStore,
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