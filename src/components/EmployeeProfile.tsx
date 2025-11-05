import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Building2, Shield, Package, Calendar, CheckCircle } from 'lucide-react';

export function EmployeeProfile() {
  const { user, employees } = useAuth();
  
  const currentEmployee = employees.find(emp => emp.id === user?.employeeId);
  
  const remainingPickups = currentEmployee ? currentEmployee.monthlyLimit - currentEmployee.currentMonthPickups : 0;

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'admin':
        return <Shield className="h-5 w-5" />;
      case 'store':
        return <Building2 className="h-5 w-5" />;
      case 'employee':
        return <User className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  const getRoleBadgeVariant = () => {
    switch (user?.role) {
      case 'admin':
        return 'default';
      case 'store':
        return 'secondary';
      case 'employee':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case 'admin':
        return 'Administrador';
      case 'store':
        return 'Loja';
      case 'employee':
        return 'Funcionário';
      default:
        return 'Usuário';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Perfil</h2>
        <p className="text-muted-foreground">Informações do seu perfil e estatísticas</p>
      </div>

      {/* User Info */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            {getRoleIcon()}
            Informações Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Nome</p>
              <p className="text-lg font-semibold text-foreground break-words">{user?.name}</p>
            </div>
            <Badge variant={getRoleBadgeVariant()} className="w-fit">
              {getRoleLabel()}
            </Badge>
          </div>
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">ID do Funcionário</p>
            <p className="text-foreground break-all">{user?.employeeId}</p>
          </div>

          {user?.storeId && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Loja Associada</p>
              <p className="text-foreground break-all">{user.storeId}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Stats */}
      {currentEmployee && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <Card className="bg-gradient-card">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Limite Mensal</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground">{currentEmployee.monthlyLimit}</p>
                  </div>
                  <Package className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Já Retirados</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground">{currentEmployee.currentMonthPickups}</p>
                  </div>
                  <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-success flex-shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card sm:col-span-2 lg:col-span-1">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Produtos Restantes</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground">{remainingPickups}</p>
                  </div>
                  <Calendar className="h-6 w-6 md:h-8 md:w-8 text-warning flex-shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Card */}
          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Progresso Mensal</CardTitle>
              <CardDescription className="text-sm">
                Acompanhe o uso do seu limite mensal de produtos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <span className="text-sm text-muted-foreground">
                  {currentEmployee.currentMonthPickups} de {currentEmployee.monthlyLimit} produtos utilizados
                </span>
                <span className="text-sm font-medium text-foreground">
                  {Math.round((currentEmployee.currentMonthPickups / currentEmployee.monthlyLimit) * 100)}%
                </span>
              </div>
              <div className="w-full bg-secondary h-3 md:h-4 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-primary h-full rounded-full transition-all duration-500 ease-in-out"
                  style={{ 
                    width: `${Math.min((currentEmployee.currentMonthPickups / currentEmployee.monthlyLimit) * 100, 100)}%` 
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}