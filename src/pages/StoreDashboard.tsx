import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { 
  Package, 
  CheckCircle,
  Clock,
  Search,
  Calendar as CalendarIcon,
  User,
  Building2,
  XCircle,
  Camera,
  QrCode,
  Keyboard
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const StoreDashboard: React.FC = () => {
  const { user, employees, stores, pickupSchedules, confirmPickup, cancelPickup, getAvailableCapacity } = useAuth();
  const { toast } = useToast();
  const [tokenInput, setTokenInput] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [cancellingToken, setCancellingToken] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tempSelectedDate, setTempSelectedDate] = useState<Date>(new Date());
  const [selectedPickup, setSelectedPickup] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentStore = stores.find(store => store.id === user?.storeId);
  const storePickups = pickupSchedules.filter(pickup => pickup.storeId === user?.storeId);
  
  // Get selected date and pickups for this store using consistent date formatting (timezone-safe)
  const localSelectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const selectedDateString = format(localSelectedDate, 'yyyy-MM-dd');
  const selectedDatePickups = storePickups.filter(pickup => 
    pickup.date === selectedDateString
  );
  
  // Get today's date and pickups for this store (timezone-safe)
  const todayDate = new Date();
  const localToday = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const today = format(localToday, 'yyyy-MM-dd');
  const todayPickups = storePickups.filter(pickup => 
    pickup.date === today
  );

  // Check if selected date is today
  const isSelectedDateToday = selectedDateString === today;
  
  // Use appropriate pickups based on selected date
  const displayPickups = isSelectedDateToday ? todayPickups : selectedDatePickups;
  const completedSelected = displayPickups.filter(p => p.status === 'completed').length;
  const pendingSelected = displayPickups.filter(p => p.status === 'scheduled').length;
  const cancelledSelected = displayPickups.filter(p => p.status === 'cancelled').length;
  const selectedDateAvailableCapacity = currentStore ? getAvailableCapacity(currentStore.id, selectedDateString) : 0;
  
  const scheduledPickups = storePickups.filter(pickup => pickup.status === 'scheduled');
  const completedPickups = storePickups.filter(pickup => pickup.status === 'completed');

  const handleConfirmPickup = async () => {
    if (!tokenInput.trim()) {
      toast({
        title: "Token obrigatório",
        description: "Digite o token para confirmar a retirada.",
        variant: "destructive",
      });
      return;
    }

    setIsConfirming(true);
    
    try {
      const success = confirmPickup(tokenInput.trim());
      
      if (success) {
        toast({
          title: "Retirada confirmada!",
          description: "O produto foi entregue com sucesso.",
        });
        setTokenInput('');
      } else {
        toast({
          title: "Token inválido",
          description: "Token não encontrado ou já utilizado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao confirmar a retirada.",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelPickup = async () => {
    if (!cancellingToken || !cancellationReason.trim()) {
      toast({
        title: "Erro",
        description: "Digite o motivo do cancelamento.",
        variant: "destructive"
      });
      return;
    }

    try {
      const success = cancelPickup(cancellingToken, cancellationReason);
      
      if (success) {
        toast({
          title: "Retirada cancelada",
          description: "O funcionário foi notificado sobre o cancelamento."
        });
        setCancellingToken(null);
        setCancellationReason('');
      } else {
        toast({
          title: "Erro",
          description: "Token não encontrado ou retirada já processada.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao cancelar retirada.",
        variant: "destructive"
      });
    }
  };

  const startCamera = async () => {
    try {
      setScannerError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      setScannerError('Erro ao acessar a câmera. Verifique as permissões.');
      console.error('Erro ao acessar câmera:', error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const captureAndScanQR = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    try {
      // Simple QR detection - in a real implementation you'd use a proper QR scanner library
      // For now, we'll show a message to manually enter the token
      toast({
        title: "Scanner QR",
        description: "Por favor, digite o token manualmente por enquanto.",
        variant: "default",
      });
      setShowScanner(false);
      stopCamera();
    } catch (error) {
      setScannerError('Erro ao processar QR Code');
    }
  };

  const handlePickupClick = (pickup: any) => {
    setSelectedPickup(pickup);
  };

  const handleConfirmPickupFromDialog = async (token: string) => {
    if (!token.trim()) {
      toast({
        title: "Token obrigatório",
        description: "Digite o token para confirmar a retirada.",
        variant: "destructive",
      });
      return;
    }

    setIsConfirming(true);
    
    try {
      const success = confirmPickup(token.trim());
      
      if (success) {
        toast({
          title: "Retirada confirmada!",
          description: "O produto foi entregue com sucesso.",
        });
        setSelectedPickup(null);
        setTokenInput('');
      } else {
        toast({
          title: "Token inválido",
          description: "Token não encontrado ou já utilizado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao confirmar a retirada.",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Painel da Loja</h2>
          <p className="text-muted-foreground">{currentStore?.name} - {currentStore?.location}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {isSelectedDateToday ? 'Agendamentos Hoje' : `Agendamentos ${format(selectedDate, 'dd/MM')}`}
                </p>
                <p className="text-3xl font-bold text-foreground">{displayPickups.length}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-bold text-foreground">{scheduledPickups.length}</p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                <p className="text-3xl font-bold text-foreground">{completedPickups.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {isSelectedDateToday ? 'Capacidade Hoje' : `Capacidade ${format(selectedDate, 'dd/MM')}`}
                </p>
                <p className="text-3xl font-bold text-foreground">{selectedDateAvailableCapacity}</p>
                <p className="text-xs text-muted-foreground">de {currentStore?.maxCapacity} total</p>
              </div>
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Token Confirmation */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Confirmar Retirada
          </CardTitle>
          <CardDescription>
            Digite o token do funcionário para confirmar a entrega dos produtos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="token">Token de Retirada</Label>
            <div className="flex gap-2">
              <Input
                id="token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Digite o token aqui..."
                className="flex-1"
              />
              <Button 
                onClick={handleConfirmPickup}
                disabled={isConfirming || !tokenInput.trim()}
                className="bg-gradient-primary"
              >
                {isConfirming ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
          
          <Alert>
            <AlertDescription>
              O funcionário deve apresentar o token que recebeu no agendamento. 
              Após a confirmação, os produtos serão marcados como entregues.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Calendar and Date Pickups */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Navegação por Data</CardTitle>
              <CardDescription>Selecione uma data para ver os agendamentos</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-60">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="space-y-3">
                    <Calendar
                      mode="single"
                      selected={tempSelectedDate}
                      onSelect={(date) => date && setTempSelectedDate(date)}
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-secondary/50 rounded-lg">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold">Capacidade para {format(selectedDate, "dd/MM/yyyy")}</h4>
              <p className="text-sm text-muted-foreground">
                Disponível: <span className="font-bold text-foreground">{selectedDateAvailableCapacity}</span> / {currentStore?.maxCapacity}
              </p>
            </div>
          </div>
          {selectedDatePickups.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Nenhuma retirada agendada para {format(selectedDate, "dd/MM/yyyy")}
              </h4>
              <p className="text-muted-foreground">Os agendamentos aparecerão aqui conforme forem realizados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedDatePickups.map((pickup) => {
                console.log('StoreDashboard - Pickup data:', pickup);
                console.log('StoreDashboard - All employees:', employees);
                console.log('StoreDashboard - Looking for employeeId:', pickup.employeeId);
                const employee = employees.find(e => e.employeeId === pickup.employeeId);
                console.log('StoreDashboard - Employee found:', employee);
                
                return (
                  <div key={pickup.id}>
                    <Dialog>
                      <DialogTrigger asChild>
                        <div 
                          className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-secondary/20 transition-colors"
                          onClick={() => handlePickupClick(pickup)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                              <User className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">{employee?.name || 'Funcionário não encontrado'}</h4>
                              <p className="text-sm text-muted-foreground">
                                Mat: {employee?.employeeId} | {pickup.quantity} produto{pickup.quantity > 1 ? 's' : ''}
                              </p>
                              {employee && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Consumo no mês: {employee.currentMonthPickups}/{employee.monthlyLimit}
                                </p>
                              )}
                              {pickup.observations && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Produtos: {pickup.observations}
                                </p>
                              )}
                              {pickup.status === 'cancelled' && pickup.cancellationReason && (
                                <p className="text-xs text-destructive mt-1">
                                  Cancelado: {pickup.cancellationReason}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(pickup.status)}
                            {pickup.completedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Confirmado às {new Date(pickup.completedAt).toLocaleTimeString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Confirmar Retirada - {employee?.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-medium text-muted-foreground">Funcionário:</p>
                              <p className="font-semibold">{employee?.name}</p>
                              <p className="text-xs text-muted-foreground">Mat: {employee?.employeeId}</p>
                              {employee && (
                                <p className="text-xs text-muted-foreground">
                                  Consumo no mês: {employee.currentMonthPickups}/{employee.monthlyLimit}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground">Quantidade:</p>
                              <p className="font-semibold">{pickup.quantity} produto{pickup.quantity > 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          
                          {pickup.observations && (
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Produtos solicitados:</p>
                              <p className="text-sm bg-secondary/50 p-2 rounded">{pickup.observations}</p>
                            </div>
                          )}

                          {pickup.status === 'scheduled' && (
                            <div className="space-y-4">
                              <Tabs defaultValue="manual" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                  <TabsTrigger value="scanner" className="flex items-center gap-2">
                                    <Camera className="h-4 w-4" />
                                    Escanear QR
                                  </TabsTrigger>
                                  <TabsTrigger value="manual" className="flex items-center gap-2">
                                    <Keyboard className="h-4 w-4" />
                                    Token Manual
                                  </TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="scanner" className="space-y-4">
                                  <div className="text-center">
                                    <p className="text-sm text-muted-foreground mb-4">
                                      Escaneie o QR Code apresentado pelo funcionário
                                    </p>
                                    
                                    {!showScanner ? (
                                      <Button 
                                        onClick={() => {
                                          setShowScanner(true);
                                          startCamera();
                                        }}
                                        className="bg-gradient-primary"
                                      >
                                        <QrCode className="h-4 w-4 mr-2" />
                                        Abrir Scanner
                                      </Button>
                                    ) : (
                                      <div className="space-y-4">
                                        <div className="relative bg-black rounded-lg overflow-hidden">
                                          <video 
                                            ref={videoRef}
                                            className="w-full h-64 object-cover"
                                            playsInline
                                          />
                                          <canvas 
                                            ref={canvasRef}
                                            className="hidden"
                                          />
                                          <div className="absolute inset-0 border-2 border-primary/50 rounded-lg pointer-events-none">
                                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-primary rounded-lg"></div>
                                          </div>
                                        </div>
                                        
                                        {scannerError && (
                                          <Alert>
                                            <AlertDescription>{scannerError}</AlertDescription>
                                          </Alert>
                                        )}
                                        
                                        <div className="flex gap-2">
                                          <Button 
                                            onClick={captureAndScanQR}
                                            className="flex-1"
                                          >
                                            <Camera className="h-4 w-4 mr-2" />
                                            Capturar
                                          </Button>
                                          <Button 
                                            variant="outline"
                                            onClick={() => {
                                              setShowScanner(false);
                                              stopCamera();
                                            }}
                                          >
                                            Fechar
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="manual" className="space-y-4">
                                  <div>
                                    <Label htmlFor="manual-token">Token de Retirada</Label>
                                    <div className="flex gap-2 mt-1">
                                      <Input
                                        id="manual-token"
                                        value={tokenInput}
                                        onChange={(e) => setTokenInput(e.target.value)}
                                        placeholder="Digite o token aqui..."
                                        className="flex-1"
                                      />
                                      <Button 
                                        onClick={() => handleConfirmPickupFromDialog(tokenInput)}
                                        disabled={isConfirming || !tokenInput.trim()}
                                        className="bg-gradient-primary"
                                      >
                                        {isConfirming ? 'Confirmando...' : 'Confirmar'}
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  <Alert>
                                    <AlertDescription>
                                      Solicite ao funcionário para mostrar o token ou QR Code do agendamento.
                                    </AlertDescription>
                                  </Alert>
                                </TabsContent>
                              </Tabs>
                            </div>
                          )}

                          {pickup.status === 'scheduled' && (
                            <div className="pt-4 border-t">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setCancellingToken(pickup.token)}
                                    className="w-full"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancelar Retirada
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Cancelar Retirada</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <p>Deseja cancelar a retirada de {employee?.name}?</p>
                                    <div>
                                      <Label htmlFor="reason">Motivo do cancelamento</Label>
                                      <Textarea
                                        id="reason"
                                        placeholder="Digite o motivo do cancelamento"
                                        value={cancellationReason}
                                        onChange={(e) => setCancellationReason(e.target.value)}
                                        rows={3}
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline" onClick={() => {
                                        setCancellingToken(null);
                                        setCancellationReason('');
                                      }}>
                                        Voltar
                                      </Button>
                                      <Button variant="destructive" onClick={handleCancelPickup}>
                                        Confirmar Cancelamento
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
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

      {/* All Store Pickups */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle>Histórico Completo</CardTitle>
          <CardDescription>Todas as retiradas desta loja</CardDescription>
        </CardHeader>
        <CardContent>
          {storePickups.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-foreground mb-2">Nenhuma retirada encontrada</h4>
              <p className="text-muted-foreground">O histórico aparecerá aqui quando houver agendamentos.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {storePickups
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((pickup) => {
                  console.log('StoreDashboard History - Pickup data:', pickup);
                  console.log('StoreDashboard History - All employees:', employees);
                  console.log('StoreDashboard History - Looking for employeeId:', pickup.employeeId);
                  const employee = employees.find(e => e.employeeId === pickup.employeeId);
                  console.log('StoreDashboard History - Employee found:', employee);
                  
                  return (
                    <div key={pickup.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{employee?.name || 'Funcionário não encontrado'}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(pickup.date).toLocaleDateString('pt-BR')} | {pickup.quantity} produto{pickup.quantity > 1 ? 's' : ''}
                          </p>
                          {pickup.observations && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Produtos: {pickup.observations}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">Token: {pickup.token}</p>
                          {pickup.status === 'cancelled' && pickup.cancellationReason && (
                            <p className="text-xs text-destructive mt-1">
                              Cancelado: {pickup.cancellationReason}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Agendado em {new Date(pickup.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(pickup.status)}
                        {pickup.completedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Concluído em {new Date(pickup.completedAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreDashboard;