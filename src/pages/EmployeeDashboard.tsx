import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Package, 
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  Plus,
  AlertTriangle,
  Building2,
  Copy,
  XCircle,
  QrCode,
  PanelLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import QRCode from 'qrcode';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { EmployeeSidebar } from '@/components/EmployeeSidebar';
import { EmployeeProfile } from '@/components/EmployeeProfile';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';

const EmployeeDashboard: React.FC = () => {
  const { 
    user, 
    employees, 
    stores, 
    pickupSchedules, 
    schedulePickup, 
    getAvailableCapacity,
    isDateBlocked,
    needsPasswordChange,
    setNeedsPasswordChange
  } = useAuth();
  const { toast } = useToast();
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | undefined>();
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [observations, setObservations] = useState('');
  const [selectedPickup, setSelectedPickup] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [activeView, setActiveView] = useState<'pedidos' | 'perfil'>('pedidos');

  const currentEmployee = employees.find(emp => emp.employeeId === user?.employeeId);
  const userPickups = pickupSchedules.filter(pickup => pickup.employeeId === user?.employeeId);
  const remainingPickups = currentEmployee ? currentEmployee.monthlyLimit - currentEmployee.currentMonthPickups : 0;

  const handleSchedulePickup = () => {
    if (!selectedStore || !selectedDate || !user?.employeeId) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione uma loja e data para o agendamento.",
        variant: "destructive",
      });
      return;
    }

    if (!currentEmployee) {
      toast({
        title: "Erro",
        description: "Dados do funcionário não encontrados.",
        variant: "destructive",
      });
      return;
    }

    if (currentEmployee.currentMonthPickups + selectedQuantity > currentEmployee.monthlyLimit) {
      toast({
        title: "Limite excedido",
        description: "Esta quantidade excede seu limite mensal.",
        variant: "destructive",
      });
      return;
    }

    // Fix timezone issue by creating a new date with local timezone reset
    const localDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const dateStr = format(localDate, 'yyyy-MM-dd');
    const availableCapacity = getAvailableCapacity(selectedStore, dateStr);
    
    if (availableCapacity < 1) {
      toast({
        title: "Loja lotada",
        description: "Esta loja não tem mais vagas disponíveis para esta data.",
        variant: "destructive"
      });
      return;
    }

    const token = schedulePickup({
      employeeId: user.employeeId,
      storeId: selectedStore,
      date: dateStr,
      quantity: selectedQuantity,
      observations
    });

    toast({
      title: "Agendamento realizado!",
      description: `Seu token é: ${token}. Anote para a retirada!`,
    });

    // Reset form
    setSelectedStore('');
    setSelectedDate(undefined);
    setTempSelectedDate(undefined);
    setSelectedQuantity(1);
    setObservations('');
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({
      title: "Token copiado!",
      description: "O token foi copiado para a área de transferência.",
    });
  };

  const generateQRCode = async (token: string) => {
    try {
      const url = await QRCode.toDataURL(token, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(url);
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
    }
  };

  const handlePickupClick = async (pickup: any) => {
    setSelectedPickup(pickup);
    if (pickup.status === 'scheduled') {
      await generateQRCode(pickup.token);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Concluída</Badge>;
      case 'scheduled':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Agendada</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    const currentHour = today.getHours();
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Disable past dates
    if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return true;
    }
    
    // Disable today if it's after 6 PM
    if (date.toDateString() === today.toDateString() && currentHour >= 18) {
      return true;
    }
    
    // Disable blocked dates
    if (isDateBlocked(dateStr)) {
      return true;
    }
    
    return false;
  };

  const renderPedidosContent = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Pedidos</h2>
          <p className="text-muted-foreground">Agende suas retiradas de produtos</p>
        </div>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Limite Mensal</p>
                <p className="text-3xl font-bold text-foreground">{currentEmployee?.monthlyLimit || 0}</p>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Já Retirados</p>
                <p className="text-3xl font-bold text-foreground">{currentEmployee?.currentMonthPickups || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Produtos Restantes</p>
                <p className="text-3xl font-bold text-foreground">{remainingPickups}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {currentEmployee && (
        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Progresso Mensal</h3>
              <span className="text-sm text-muted-foreground">
                {currentEmployee.currentMonthPickups}/{currentEmployee.monthlyLimit}
              </span>
            </div>
            <div className="w-full bg-secondary h-4 rounded-full">
              <div 
                className="bg-gradient-primary h-4 rounded-full transition-all"
                style={{ 
                  width: `${(currentEmployee.currentMonthPickups / currentEmployee.monthlyLimit) * 100}%` 
                }}
              />
            </div>
            {remainingPickups === 0 && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Você atingiu seu limite mensal de produtos. O limite será renovado no próximo mês.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Schedule New Pickup */}
      {remainingPickups > 0 && (
        <Card className="bg-gradient-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Agendar Nova Retirada
            </CardTitle>
            <CardDescription>
              Selecione a loja, data e quantidade de produtos para retirada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store">Loja</Label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {store.name} - {store.location}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data da Retirada</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Selecione uma data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="space-y-3">
                      <Calendar
                        mode="single"
                        selected={tempSelectedDate}
                        onSelect={setTempSelectedDate}
                        disabled={(date) => {
                          const today = new Date();
                          const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                          return isDateDisabled(date) || date > maxDate;
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                      <div className="px-3 pb-3">
                        <Button 
                          onClick={() => setSelectedDate(tempSelectedDate)}
                          className="w-full bg-gradient-primary"
                          size="sm"
                        >
                          Aplicar Filtro
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {selectedStore && selectedDate && (
                  <div className="text-sm text-muted-foreground mt-1">
                    <p>Vagas disponíveis: {getAvailableCapacity(selectedStore, format(selectedDate, 'yyyy-MM-dd'))}</p>
                    {selectedDate.toDateString() === new Date().toDateString() && (
                      <p className="text-warning text-xs">⚠️ Retirada para hoje - confirme disponibilidade da loja</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="quantity">Quantidade (máx: {remainingPickups})</Label>
              <Select value={selectedQuantity.toString()} onValueChange={(value) => setSelectedQuantity(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: Math.min(remainingPickups, 6) }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} produto{num > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Restam {remainingPickups} produtos disponíveis neste mês
              </p>
            </div>

            <div>
              <Label htmlFor="observations">Observações</Label>
              <Textarea
                id="observations"
                placeholder="Descreva os produtos que deseja retirar (opcional)"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>

            <Button 
              onClick={handleSchedulePickup} 
              className="w-full bg-gradient-primary"
              disabled={!selectedStore || !selectedDate}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Agendar Retirada
            </Button>
          </CardContent>
        </Card>
      )}

      {/* My Pickups */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle>Minhas Retiradas</CardTitle>
          <CardDescription>Histórico de agendamentos e retiradas</CardDescription>
        </CardHeader>
        <CardContent>
          {userPickups.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-foreground mb-2">Nenhuma retirada encontrada</h4>
              <p className="text-muted-foreground">Suas retiradas aparecerão aqui quando forem agendadas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {userPickups.map((pickup) => {
                const store = stores.find(s => s.id === pickup.storeId);
                
                return (
                  <div key={pickup.id}>
                    <Dialog>
                      <DialogTrigger asChild>
                        <div 
                          className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-secondary/20 transition-colors"
                          onClick={() => handlePickupClick(pickup)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
                              <Package className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">{store?.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {new Date(pickup.date).toLocaleDateString('pt-BR')} | {pickup.quantity} produto{pickup.quantity > 1 ? 's' : ''}
                              </p>
                              {pickup.observations && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Produtos: {pickup.observations}
                                </p>
                              )}
                              {pickup.status === 'cancelled' && pickup.cancellationReason && (
                                <p className="text-xs text-destructive mt-1">
                                  Motivo do cancelamento: {pickup.cancellationReason}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(pickup.status)}
                            {pickup.completedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Retirado em {new Date(pickup.completedAt).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Detalhes do Pedido</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-muted-foreground">Token:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="bg-secondary px-2 py-1 rounded text-foreground font-mono">
                                  {pickup.token}
                                </code>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => copyToken(pickup.token)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">Loja:</span>
                              <p className="mt-1 text-foreground">{store?.name}</p>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">Data:</span>
                              <p className="mt-1 text-foreground">{new Date(pickup.date).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">Quantidade:</span>
                              <p className="mt-1 text-foreground">{pickup.quantity}</p>
                            </div>
                          </div>
                          
                          {pickup.observations && (
                            <div>
                              <span className="font-medium text-muted-foreground">Observações:</span>
                              <p className="mt-1 text-foreground text-sm">{pickup.observations}</p>
                            </div>
                          )}
                          
                          <div>
                            <span className="font-medium text-muted-foreground">Status:</span>
                            <div className="mt-1">{getStatusBadge(pickup.status)}</div>
                          </div>

                          {pickup.status === 'scheduled' && qrCodeUrl && (
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground mb-2">QR Code para retirada:</p>
                              <img src={qrCodeUrl} alt="QR Code" className="mx-auto border rounded" />
                            </div>
                          )}

                          {pickup.completedAt && (
                            <div>
                              <span className="font-medium text-muted-foreground">Data de Retirada:</span>
                              <p className="mt-1 text-foreground">{new Date(pickup.completedAt).toLocaleDateString('pt-BR')}</p>
                            </div>
                          )}

                          {pickup.status === 'cancelled' && pickup.cancellationReason && (
                            <div>
                              <span className="font-medium text-muted-foreground">Motivo do Cancelamento:</span>
                              <p className="mt-1 text-foreground">{pickup.cancellationReason}</p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    if (activeView === 'perfil') {
      return <EmployeeProfile />;
    }
    return renderPedidosContent();
  };

  return (
    <>
      <ChangePasswordDialog 
        open={needsPasswordChange} 
        onPasswordChanged={() => setNeedsPasswordChange(false)}
      />
      <SidebarProvider defaultOpen={true}>
        <div className="min-h-screen flex w-full">
          <EmployeeSidebar activeView={activeView} onViewChange={setActiveView} />
          <SidebarInset className="flex-1">
            <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b">
              <SidebarTrigger className="-ml-1" />
              <div className="flex items-center space-x-2">
                <div className="h-6 w-6 rounded bg-gradient-primary flex items-center justify-center">
                  <Building2 className="h-3 w-3 text-primary-foreground" />
                </div>
                <h1 className="text-lg font-semibold">Sistema de Retiradas</h1>
              </div>
            </header>
            <main className="flex-1 p-6">
              {renderContent()}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </>
  );
};

export default EmployeeDashboard;