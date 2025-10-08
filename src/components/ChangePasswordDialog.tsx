import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Check, X } from 'lucide-react';

interface ChangePasswordDialogProps {
  open: boolean;
  onPasswordChanged: () => void;
}

export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({ open, onPasswordChanged }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Password validation regex
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar && passwordsMatch;

  const handleChangePassword = async () => {
    if (!isPasswordValid) {
      toast({
        title: "Senha inválida",
        description: "Por favor, atenda todos os requisitos de senha.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast({
          title: "Erro ao alterar senha",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua senha foi atualizada.",
      });

      onPasswordChanged();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao alterar a senha.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Alterar Senha Obrigatória</DialogTitle>
          <DialogDescription>
            Por segurança, você precisa criar uma senha forte antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="newPassword">Nova Senha</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite sua nova senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme sua nova senha"
            />
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">Requisitos da senha:</p>
            <div className="space-y-1">
              <PasswordRequirement met={hasMinLength} text="Mínimo de 8 caracteres" />
              <PasswordRequirement met={hasUpperCase} text="Pelo menos uma letra maiúscula" />
              <PasswordRequirement met={hasLowerCase} text="Pelo menos uma letra minúscula" />
              <PasswordRequirement met={hasNumber} text="Pelo menos um número" />
              <PasswordRequirement met={hasSpecialChar} text="Pelo menos um caractere especial (!@#$%^&*)" />
              <PasswordRequirement met={passwordsMatch} text="As senhas devem coincidir" />
            </div>
          </div>

          <Button 
            onClick={handleChangePassword} 
            className="w-full bg-gradient-primary"
            disabled={!isPasswordValid || isLoading}
          >
            {isLoading ? "Alterando..." : "Alterar Senha"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PasswordRequirement: React.FC<{ met: boolean; text: string }> = ({ met, text }) => (
  <div className="flex items-center gap-2">
    {met ? (
      <Check className="h-4 w-4 text-success" />
    ) : (
      <X className="h-4 w-4 text-destructive" />
    )}
    <span className={met ? "text-success" : "text-muted-foreground"}>{text}</span>
  </div>
);
