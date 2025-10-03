import React, { createContext, useContext, useState, useEffect } from 'react';

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
  employees: Employee[];
  stores: Store[];
  pickupSchedules: PickupSchedule[];
  storeCapacities: StoreCapacity[];
  blockedDates: BlockedDate[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  addEmployee: (employee: Omit<Employee, 'id' | 'currentMonthPickups' | 'lastResetMonth'>) => void;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default data
const defaultUsers: User[] = [
  { id: '1', name: 'Admin', email: 'admin@empresa.com', role: 'admin' },
  { id: '2', name: 'Loja Centro', email: 'loja.centro@empresa.com', role: 'store', storeId: '1' },
  { id: '3', name: 'João Silva', email: 'joao.silva@empresa.com', role: 'employee', employeeId: '1001', managerId: 'gerente1' }
];

const defaultEmployees: Employee[] = [
  {
    id: '1001',
    name: 'João Silva',
    email: 'joao.silva@empresa.com',
    employeeId: '1001',
    managerId: 'gerente1@empresa.com',
    department: 'Vendas',
    monthlyLimit: 6,
    currentMonthPickups: 0,
    lastResetMonth: new Date().toISOString().slice(0, 7)
  }
];

const defaultStores: Store[] = [
  { id: '1', name: 'Loja Centro', maxCapacity: 10, location: 'Centro da Cidade' },
  { id: '2', name: 'Loja Shopping', maxCapacity: 15, location: 'Shopping Mall' }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [pickupSchedules, setPickupSchedules] = useState<PickupSchedule[]>([]);
  const [storeCapacities, setStoreCapacities] = useState<StoreCapacity[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [users, setUsers] = useState<User[]>(defaultUsers);

  useEffect(() => {
    // Load data from localStorage
    const savedEmployees = localStorage.getItem('employees');
    const savedStores = localStorage.getItem('stores');
    const savedPickups = localStorage.getItem('pickupSchedules');
    const savedCapacities = localStorage.getItem('storeCapacities');
    const savedBlockedDates = localStorage.getItem('blockedDates');
    const savedUser = localStorage.getItem('currentUser');
    const savedUsers = localStorage.getItem('users');

    setEmployees(savedEmployees ? JSON.parse(savedEmployees) : defaultEmployees);
    setStores(savedStores ? JSON.parse(savedStores) : defaultStores);
    setPickupSchedules(savedPickups ? JSON.parse(savedPickups) : []);
    setStoreCapacities(savedCapacities ? JSON.parse(savedCapacities) : []);
    setBlockedDates(savedBlockedDates ? JSON.parse(savedBlockedDates) : []);
    setUsers(savedUsers ? JSON.parse(savedUsers) : defaultUsers);
    
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    // Check if we need to reset monthly limits
    checkAndResetMonthlyLimits();
  }, []);

  const checkAndResetMonthlyLimits = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const savedEmployees = localStorage.getItem('employees');
    const employeeList = savedEmployees ? JSON.parse(savedEmployees) : defaultEmployees;
    
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

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simple mock authentication
    const foundUser = users.find(u => u.email === email);
    if (foundUser && password === '123456') {
      setUser(foundUser);
      localStorage.setItem('currentUser', JSON.stringify(foundUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const addEmployee = (employeeData: Omit<Employee, 'id' | 'currentMonthPickups' | 'lastResetMonth'>) => {
    const newEmployee: Employee = {
      ...employeeData,
      id: Date.now().toString(),
      currentMonthPickups: 0,
      lastResetMonth: new Date().toISOString().slice(0, 7)
    };
    
    // Create user account for the employee
    const newUser: User = {
      id: Date.now().toString(),
      name: employeeData.name,
      email: employeeData.email,
      role: 'employee',
      employeeId: employeeData.employeeId,
      managerId: employeeData.managerId
    };
    
    const updatedEmployees = [...employees, newEmployee];
    const updatedUsers = [...users, newUser];
    
    setEmployees(updatedEmployees);
    setUsers(updatedUsers);
    localStorage.setItem('employees', JSON.stringify(updatedEmployees));
    localStorage.setItem('users', JSON.stringify(updatedUsers));
  };

  const addStore = (storeData: Omit<Store, 'id'>) => {
    const newStore: Store = {
      ...storeData,
      id: Date.now().toString()
    };
    
    // Create user account for the store
    const newUser: User = {
      id: Date.now().toString(),
      name: storeData.name,
      email: `${storeData.name.toLowerCase().replace(/\s+/g, '.')}@empresa.com`,
      role: 'store',
      storeId: newStore.id
    };
    
    const updatedStores = [...stores, newStore];
    const updatedUsers = [...users, newUser];
    
    setStores(updatedStores);
    setUsers(updatedUsers);
    localStorage.setItem('stores', JSON.stringify(updatedStores));
    localStorage.setItem('users', JSON.stringify(updatedUsers));
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

  const blockDate = (date: string, reason?: string) => {
    const newBlockedDate: BlockedDate = { date, reason };
    const updatedBlockedDates = [...blockedDates, newBlockedDate];
    setBlockedDates(updatedBlockedDates);
    localStorage.setItem('blockedDates', JSON.stringify(updatedBlockedDates));
  };

  const unblockDate = (date: string) => {
    const updatedBlockedDates = blockedDates.filter(bd => bd.date !== date);
    setBlockedDates(updatedBlockedDates);
    localStorage.setItem('blockedDates', JSON.stringify(updatedBlockedDates));
  };

  const isDateBlocked = (date: string): boolean => {
    return blockedDates.some(bd => bd.date === date);
  };

  return (
    <AuthContext.Provider value={{
      user,
      employees,
      stores,
      pickupSchedules,
      storeCapacities,
      blockedDates,
      login,
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
      isDateBlocked
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