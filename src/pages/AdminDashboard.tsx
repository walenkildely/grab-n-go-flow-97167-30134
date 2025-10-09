import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Ban, Unlock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Users, 
  Building2, 
  Package, 
  TrendingUp, 
  Plus, 
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Admin Dashboard Component - Date Range Blocking Feature
const AdminDashboard: React.FC = () => {
  const { 
    employees, 
    stores, 
    pickupSchedules, 
    storeCapacities,
    blockedDates,
    addEmployee, 
    addStore, 
    updateStoreMaxCapacity,
    updateStoreDateCapacity,
    blockDate,
    unblockDate,
    isDateBlocked,
    getAvailableCapacity
  } = useAuth();
  const { toast } = useToast();
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    employeeId: '',
    managerId: '',
    department: '',
    monthlyLimit: 6
  });
  const [newStore, setNewStore] = useState({
    name: '',
    maxCapacity: 10,
    location: ''
  });
  const [editingStore, setEditingStore] = useState<{id: string, maxCapacity: number} | null>(null);
  const [editingDateCapacity, setEditingDateCapacity] = useState<{storeId: string, date: string, capacity: number} | null>(null);
  const [selectedDateForCapacity, setSelectedDateForCapacity] = useState<Date | undefined>();
  const [tempSelectedDateForCapacity, setTempSelectedDateForCapacity] = useState<Date | undefined>();
  const [selectedStoreForCapacity, setSelectedStoreForCapacity] = useState('');
  const [newCapacityValue, setNewCapacityValue] = useState("");
  const [selectedDateRangeForBlock, setSelectedDateRangeForBlock] = useState<{ from: Date | undefined; to?: Date | undefined }>();
  const [tempSelectedDateRangeForBlock, setTempSelectedDateRangeForBlock] = useState<{ from: Date | undefined; to?: Date | undefined }>();
  const [blockReason, setBlockReason] = useState("");

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.employeeId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      await addEmployee(newEmployee);
      setNewEmployee({
        name: '',
        email: '',
        employeeId: '',
        managerId: '',
        department: '',
        monthlyLimit: 6
      });
      
      toast({
        title: "Funcionário adicionado!",
        description: `${newEmployee.name} foi cadastrado com sucesso. Senha padrão: 123456`,
      });
    } catch (error) {
      toast({
        title: "Erro ao adicionar funcionário",
        description: "Ocorreu um erro ao cadastrar o funcionário. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleAddStore = () => {
    if (!newStore.name || !newStore.location) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    addStore(newStore);
    setNewStore({
      name: '',
      maxCapacity: 10,
      location: ''
    });
    
    toast({
      title: "Loja adicionada!",
      description: `${newStore.name} foi cadastrada com sucesso.`,
    });
  };

  const handleUpdateStoreCapacity = () => {
    if (!editingStore) return;
    
    updateStoreMaxCapacity(editingStore.id, editingStore.maxCapacity);
    
    setEditingStore(null);
    toast({
      title: "Capacidade atualizada!",
      description: "A capacidade da loja foi alterada com sucesso.",
    });
  };

  const handleUpdateDateCapacity = () => {
    if (selectedStoreForCapacity && selectedDateForCapacity && newCapacityValue) {
      const localDate = new Date(selectedDateForCapacity.getFullYear(), selectedDateForCapacity.getMonth(), selectedDateForCapacity.getDate());
      const dateStr = format(localDate, 'yyyy-MM-dd');
      updateStoreDateCapacity(selectedStoreForCapacity, dateStr, parseInt(newCapacityValue));
      setSelectedDateForCapacity(undefined);
      setNewCapacityValue("");
      toast({
        title: "Capacidade atualizada",
        description: `Capacidade da data ${format(selectedDateForCapacity, 'dd/MM/yyyy', { locale: ptBR })} atualizada para ${newCapacityValue}`,
      });
    }
  };

  const handleBlockDate = () => {
    if (selectedDateRangeForBlock?.from) {
      const startDate = selectedDateRangeForBlock.from;
      const endDate = selectedDateRangeForBlock.to || startDate;
      
      // Create array of dates in the range
      const dates: Date[] = [];
      const currentDate = new Date(startDate);
      const finalDate = new Date(endDate);
      
      while (currentDate <= finalDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Block all dates in range
      dates.forEach(date => {
        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dateStr = format(localDate, 'yyyy-MM-dd');
        if (!isDateBlocked(dateStr)) {
          blockDate(dateStr, blockReason);
        }
      });
      
      const dateRangeText = selectedDateRangeForBlock.to 
        ? `${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} até ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`
        : format(startDate, 'dd/MM/yyyy', { locale: ptBR });
      
      toast({
        title: "Datas bloqueadas",
        description: `${dates.length} data(s) bloqueada(s): ${dateRangeText}`,
      });
      
      setSelectedDateRangeForBlock(undefined);
      setTempSelectedDateRangeForBlock(undefined);
      setBlockReason("");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Concluída</Badge>;
      case 'scheduled':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Agendada</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const completedPickups = pickupSchedules.filter(p => p.status === 'completed').length;
  const scheduledPickups = pickupSchedules.filter(p => p.status === 'scheduled').length;
  const totalProducts = pickupSchedules
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.quantity, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Painel Administrativo</h2>
          <p className="text-muted-foreground">Gerencie funcionários, lojas e monitore retiradas</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Funcionários</p>
                <p className="text-3xl font-bold text-foreground">{employees.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lojas Ativas</p>
                <p className="text-3xl font-bold text-foreground">{stores.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Produtos Retirados</p>
                <p className="text-3xl font-bold text-foreground">{totalProducts}</p>
              </div>
              <Package className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Agendamentos</p>
                <p className="text-3xl font-bold text-foreground">{scheduledPickups}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="employees">Funcionários</TabsTrigger>
          <TabsTrigger value="stores">Lojas</TabsTrigger>
          <TabsTrigger value="capacity">Capacidade por Data</TabsTrigger>
          <TabsTrigger value="pickups">Retiradas</TabsTrigger>
          <TabsTrigger value="blocked">Datas Bloqueadas</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Gestão de Funcionários</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Funcionário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Funcionário</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome Completo*</Label>
                      <Input
                        id="name"
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                        placeholder="João Silva"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email*</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                        placeholder="joao@empresa.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="employeeId">Matrícula*</Label>
                      <Input
                        id="employeeId"
                        value={newEmployee.employeeId}
                        onChange={(e) => setNewEmployee({...newEmployee, employeeId: e.target.value})}
                        placeholder="1001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="department">Departamento</Label>
                      <Input
                        id="department"
                        value={newEmployee.department}
                        onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}
                        placeholder="Vendas"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="managerId">Email do Gerente</Label>
                      <Input
                        id="managerId"
                        type="email"
                        value={newEmployee.managerId}
                        onChange={(e) => setNewEmployee({...newEmployee, managerId: e.target.value})}
                        placeholder="gerente@empresa.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthlyLimit">Limite Mensal</Label>
                      <Input
                        id="monthlyLimit"
                        type="number"
                        value={newEmployee.monthlyLimit}
                        onChange={(e) => setNewEmployee({...newEmployee, monthlyLimit: parseInt(e.target.value)})}
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddEmployee} className="w-full bg-gradient-primary">
                    Cadastrar Funcionário
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {employees.map((employee) => (
              <Card key={employee.id} className="bg-gradient-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                        <Users className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">{employee.name}</h4>
                        <p className="text-sm text-muted-foreground">Mat: {employee.employeeId} | {employee.department}</p>
                        <p className="text-xs text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        Produtos: {employee.currentMonthPickups}/{employee.monthlyLimit}
                      </p>
                      <div className="w-32 bg-secondary h-2 rounded-full mt-1">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${(employee.currentMonthPickups / employee.monthlyLimit) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stores" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Gestão de Lojas</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Loja
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Loja</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="storeName">Nome da Loja*</Label>
                    <Input
                      id="storeName"
                      value={newStore.name}
                      onChange={(e) => setNewStore({...newStore, name: e.target.value})}
                      placeholder="Loja Centro"
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Localização*</Label>
                    <Input
                      id="location"
                      value={newStore.location}
                      onChange={(e) => setNewStore({...newStore, location: e.target.value})}
                      placeholder="Centro da Cidade"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxCapacity">Capacidade Máxima</Label>
                    <Input
                      id="maxCapacity"
                      type="number"
                      value={newStore.maxCapacity}
                      onChange={(e) => setNewStore({...newStore, maxCapacity: parseInt(e.target.value)})}
                      min="1"
                      max="50"
                    />
                  </div>
                  <Button onClick={handleAddStore} className="w-full bg-gradient-primary">
                    Cadastrar Loja
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {stores.map((store) => (
              <Card key={store.id} className="bg-gradient-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">{store.name}</h4>
                        <p className="text-sm text-muted-foreground">{store.location}</p>
                      </div>
                    </div>
                     <div className="text-right flex flex-col gap-2">
                       <div>
                         <p className="text-sm font-medium">Capacidade Máxima</p>
                         <p className="text-2xl font-bold text-primary">{store.maxCapacity}</p>
                       </div>
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button 
                             variant="outline" 
                             size="sm"
                             onClick={() => setEditingStore({id: store.id, maxCapacity: store.maxCapacity})}
                           >
                             Editar Capacidade
                           </Button>
                         </DialogTrigger>
                         <DialogContent>
                           <DialogHeader>
                             <DialogTitle>Alterar Capacidade da Loja</DialogTitle>
                           </DialogHeader>
                           <div className="space-y-4">
                             <p>Loja: <strong>{store.name}</strong></p>
                             <div>
                               <Label htmlFor="newCapacity">Nova Capacidade Diária</Label>
                               <Input
                                 id="newCapacity"
                                 type="number"
                                 value={editingStore?.maxCapacity || store.maxCapacity}
                                 onChange={(e) => setEditingStore(prev => 
                                   prev ? {...prev, maxCapacity: parseInt(e.target.value)} : null
                                 )}
                                 min="1"
                                 max="50"
                               />
                             </div>
                             <div className="flex justify-end gap-2">
                               <Button variant="outline" onClick={() => setEditingStore(null)}>
                                 Cancelar
                               </Button>
                               <Button onClick={handleUpdateStoreCapacity}>
                                 Salvar
                               </Button>
                             </div>
                           </div>
                         </DialogContent>
                       </Dialog>
                     </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="capacity" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Gestão de Capacidade por Data</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Definir Capacidade Específica
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Capacidade Específica por Data</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Loja</Label>
                    <select 
                      className="w-full p-2 border rounded"
                      onChange={(e) => setEditingDateCapacity(prev => 
                        prev ? {...prev, storeId: e.target.value} : {storeId: e.target.value, date: '', capacity: 10}
                      )}
                    >
                      <option value="">Selecione uma loja</option>
                      {stores.map(store => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <Label>Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDateForCapacity ? format(selectedDateForCapacity, "dd/MM/yyyy") : "Selecione uma data"}
                        </Button>
                      </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="space-y-3">
                            <CalendarComponent
                              mode="single"
                              selected={tempSelectedDateForCapacity}
                              onSelect={setTempSelectedDateForCapacity}
                              disabled={(date) => date < new Date()}
                              initialFocus
                              className="pointer-events-auto"
                            />
                            <div className="px-3 pb-3">
                              <Button 
                                onClick={() => {
                                  setSelectedDateForCapacity(tempSelectedDateForCapacity);
                                  if (tempSelectedDateForCapacity) {
                                    const localDate = new Date(tempSelectedDateForCapacity.getFullYear(), tempSelectedDateForCapacity.getMonth(), tempSelectedDateForCapacity.getDate());
                                    const dateStr = format(localDate, 'yyyy-MM-dd');
                                    setEditingDateCapacity(prev => 
                                      prev ? {...prev, date: dateStr} : {storeId: '', date: dateStr, capacity: 10}
                                    );
                                  }
                                }}
                                className="w-full bg-gradient-primary"
                                size="sm"
                              >
                                Aplicar Filtro
                              </Button>
                            </div>
                          </div>
                       </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="dateCapacity">Capacidade para esta Data</Label>
                    <Input
                      id="dateCapacity"
                      type="number"
                      value={editingDateCapacity?.capacity || 10}
                      onChange={(e) => setEditingDateCapacity(prev => 
                        prev ? {...prev, capacity: parseInt(e.target.value)} : {storeId: '', date: '', capacity: parseInt(e.target.value)}
                      )}
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => {
                      setEditingDateCapacity(null);
                      setSelectedDateForCapacity(undefined);
                      setTempSelectedDateForCapacity(undefined);
                    }}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleUpdateDateCapacity}
                      disabled={!editingDateCapacity?.storeId || !editingDateCapacity?.date}
                    >
                      Salvar Capacidade
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {stores.map((store) => {
              const storeCapacitiesForStore = storeCapacities.filter(sc => sc.storeId === store.id);
              
              return (
                <Card key={store.id} className="bg-gradient-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{store.name}</h4>
                          <p className="text-sm text-muted-foreground">Capacidade padrão: {store.maxCapacity}</p>
                        </div>
                      </div>
                    </div>
                    
                    {storeCapacitiesForStore.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm">Capacidades específicas por data:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {storeCapacitiesForStore.map((capacity) => (
                            <div key={capacity.date} className="flex items-center justify-between p-2 bg-secondary/50 rounded">
                              <span className="text-sm">{format(new Date(capacity.date), 'dd/MM/yyyy')}</span>
                              <div className="text-sm">
                                <span className="font-medium">{getAvailableCapacity(store.id, capacity.date)}</span>
                                <span className="text-muted-foreground">/{capacity.maxCapacity}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {storeCapacitiesForStore.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhuma capacidade específica definida. Usando capacidade padrão.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="pickups" className="space-y-6">
          <h3 className="text-xl font-semibold">Histórico de Retiradas</h3>
          <div className="grid gap-4">
            {pickupSchedules.length === 0 ? (
              <Card className="bg-gradient-card">
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-foreground mb-2">Nenhuma retirada encontrada</h4>
                  <p className="text-muted-foreground">As retiradas aparecerão aqui quando forem agendadas.</p>
                </CardContent>
              </Card>
            ) : (
              pickupSchedules.map((pickup) => {
                const employee = employees.find(e => e.employeeId === pickup.employeeId);
                const store = stores.find(s => s.id === pickup.storeId);
                
                return (
                  <Card key={pickup.id} className="bg-gradient-card">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                            <Package className="h-6 w-6 text-primary-foreground" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">{employee?.name || 'Funcionário não encontrado'}</h4>
                            <p className="text-sm text-muted-foreground">
                              {store?.name} | {new Date(pickup.date).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-xs text-muted-foreground">Token: {pickup.token}</p>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <p className="text-lg font-bold text-primary">{pickup.quantity} produtos</p>
                          {getStatusBadge(pickup.status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="blocked" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciar Datas Bloqueadas</CardTitle>
              <CardDescription>
                Bloqueie datas específicas para impedir agendamentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="block-date">Selecionar Data ou Intervalo</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDateRangeForBlock?.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDateRangeForBlock?.from ? (
                          selectedDateRangeForBlock.to ? (
                            `${format(selectedDateRangeForBlock.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(selectedDateRangeForBlock.to, "dd/MM/yyyy", { locale: ptBR })}`
                          ) : (
                            format(selectedDateRangeForBlock.from, "dd/MM/yyyy", { locale: ptBR })
                          )
                        ) : (
                          "Selecione uma data ou intervalo"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="space-y-3">
                        <CalendarComponent
                          mode="range"
                          selected={tempSelectedDateRangeForBlock}
                          onSelect={setTempSelectedDateRangeForBlock}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                        <div className="px-3 pb-3">
                          <Button 
                            onClick={() => setSelectedDateRangeForBlock(tempSelectedDateRangeForBlock)}
                            className="w-full bg-gradient-primary"
                            size="sm"
                          >
                            Aplicar Seleção
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div>
                  <Label htmlFor="block-reason">Motivo (opcional)</Label>
                  <Textarea
                    id="block-reason"
                    placeholder="Motivo do bloqueio..."
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleBlockDate}
                disabled={!selectedDateRangeForBlock?.from}
                className="w-full bg-gradient-primary"
              >
                <Ban className="mr-2 h-4 w-4" />
                Bloquear {selectedDateRangeForBlock?.to ? "Intervalo" : "Data"}
              </Button>
            </CardContent>
          </Card>

          {blockedDates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Datas Bloqueadas</CardTitle>
                <CardDescription>
                  Lista de datas que estão bloqueadas para agendamentos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {blockedDates.map((blockedDate) => (
                    <div key={blockedDate.date} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {format(new Date(blockedDate.date), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                        {blockedDate.reason && (
                          <p className="text-sm text-muted-foreground">{blockedDate.reason}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          unblockDate(blockedDate.date);
                          toast({
                            title: "Data desbloqueada",
                            description: `A data foi desbloqueada para agendamentos`,
                          });
                        }}
                      >
                        <Unlock className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;