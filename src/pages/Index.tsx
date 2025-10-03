import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import LoginForm from '@/components/LoginForm';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import StoreDashboard from './StoreDashboard';

const Index = () => {
  const { user } = useAuth();

  // Show login form if user is not authenticated
  if (!user) {
    return <LoginForm />;
  }

  // Show appropriate dashboard based on user role
  const renderDashboard = () => {
    switch (user.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'employee':
        return <EmployeeDashboard />;
      case 'store':
        return <StoreDashboard />;
      default:
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Acesso não autorizado</h2>
            <p className="text-muted-foreground">Seu tipo de usuário não tem permissão para acessar o sistema.</p>
          </div>
        );
    }
  };

  return (
    <Layout>
      {renderDashboard()}
    </Layout>
  );
};

export default Index;
