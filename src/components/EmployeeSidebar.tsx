import React from 'react';
import { Package, User, LogOut, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EmployeeSidebarProps {
  activeView: 'pedidos' | 'perfil';
  onViewChange: (view: 'pedidos' | 'perfil') => void;
}

export function EmployeeSidebar({ activeView, onViewChange }: EmployeeSidebarProps) {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'admin':
        return <Building2 className="h-4 w-4" />;
      case 'store':
        return <Building2 className="h-4 w-4" />;
      case 'employee':
        return <User className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
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

  const menuItems = [
    {
      title: 'Pedidos',
      icon: Package,
      key: 'pedidos' as const,
      isActive: activeView === 'pedidos',
    },
    {
      title: 'Perfil',
      icon: User,
      key: 'perfil' as const,
      isActive: activeView === 'perfil',
    },
  ];

  return (
    <Sidebar className={isCollapsed ? 'w-14' : 'w-60'} collapsible="icon">
      <SidebarHeader className="p-4">
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-sidebar-foreground">Sistema de Retiradas</h2>
              <p className="text-xs text-sidebar-foreground/70">Funcionário</p>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.key)}
                    isActive={item.isActive}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <item.icon className="h-4 w-4" />
                    {!isCollapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-4">
        {!isCollapsed && user && (
          <Card className="p-3">
            <div className="flex items-center space-x-3">
              {getRoleIcon()}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</span>
                <Badge variant={getRoleBadgeVariant()} className="text-xs w-fit">
                  {getRoleLabel()}
                </Badge>
              </div>
            </div>
          </Card>
        )}
        
        <Button 
          variant="outline" 
          size={isCollapsed ? "icon" : "sm"} 
          onClick={logout}
          className="w-full"
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}