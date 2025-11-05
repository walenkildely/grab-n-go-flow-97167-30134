import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Building2, Shield, Package, Calendar, CheckCircle } from 'lucide-react';

export function EmployeeProfile() {
  const { user, employees } = useAuth();
  
  console.log('EmployeeProfile - user:', user);
  console.log('EmployeeProfile - employees:', employees);
  console.log('EmployeeProfile - searching for employeeId:', user?.employeeId);
  
  const currentEmployee = employees.find(emp => {
    console.log('Comparing emp.id:', emp.id, 'with user.employeeId:', user?.employeeId);
    return emp.id === user?.employeeId;
  });
  
  console.log('EmployeeProfile - currentEmployee found:', currentEmployee);
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
          <CardTitle className="flex items-center gap-2">
            {getRoleIcon()}
            Informações Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nome</p>
              <p className="text-lg font-semibold text-foreground">{user?.name}</p>
            </div>
            <Badge variant={getRoleBadgeVariant()}>
              {getRoleLabel()}
            </Badge>
          </div>
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">ID do Funcionário</p>
            <p className="text-foreground">{user?.employeeId}</p>
          </div>

          {user?.storeId && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Loja Associada</p>
              <p className="text-foreground">{user.storeId}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Stats */}
      {currentEmployee && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Limite Mensal</p>
                    <p className="text-3xl font-bold text-foreground">{currentEmployee.monthlyLimit}</p>
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
                    <p className="text-3xl font-bold text-foreground">{currentEmployee.currentMonthPickups}</p>
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
                  <Calendar className="h-8 w-8 text-warning" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Card */}
          <Card className="bg-gradient-card">
            <CardHeader>
              <CardTitle>Progresso Mensal</CardTitle>
              <CardDescription>
                Acompanhe o uso do seu limite mensal de produtos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">
                  {currentEmployee.currentMonthPickups} de {currentEmployee.monthlyLimit} produtos utilizados
                </span>
                <span className="text-sm font-medium text-foreground">
                  {Math.round((currentEmployee.currentMonthPickups / currentEmployee.monthlyLimit) * 100)}%
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}