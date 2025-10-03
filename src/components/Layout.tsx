import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Building2, Shield } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const getRoleIcon = () => {
    switch (user.role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'store':
        return <Building2 className="h-4 w-4" />;
      case 'employee':
        return <User className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = () => {
    switch (user.role) {
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
    switch (user.role) {
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
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary">
      <nav className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Sistema de Retiradas</h1>
                <p className="text-sm text-muted-foreground">Gestão de Produtos para Funcionários</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Card className="px-4 py-2">
                <div className="flex items-center space-x-3">
                  {getRoleIcon()}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{user.name}</span>
                    <Badge variant={getRoleBadgeVariant()} className="text-xs">
                      {getRoleLabel()}
                    </Badge>
                  </div>
                </div>
              </Card>
              
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;