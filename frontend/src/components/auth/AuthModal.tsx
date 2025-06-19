
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { authApi } from "@/lib/api";

interface AuthModalProps {
  onAuthSuccess: (token: string, user: any) => void;
  initialTab?: 'login' | 'register';
}

export function AuthModal({ onAuthSuccess, initialTab = 'login' }: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ email: '', password: '', confirmPassword: '' });
  const { toast } = useToast();
  
  // Helper function to switch tabs
  const switchToLogin = () => setActiveTab('login');
  const switchToRegister = () => setActiveTab('register');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { access_token } = await authApi.login(loginData.email, loginData.password);
      localStorage.setItem('authToken', access_token);
      
      // Get user info
      const user = await authApi.getMe();
      onAuthSuccess(access_token, user);
      toast({ title: "Login successful", description: "Welcome back!" });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Please check your credentials";
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      await authApi.register(registerData.email, registerData.password, registerData.email);
      toast({ 
        title: "Registration successful", 
        description: "Please log in with your credentials" 
      });
      
      // Auto-switch to login tab
      setLoginData(prev => ({ ...prev, email: registerData.email, password: '' }));
      setRegisterData({ email: '', password: '', confirmPassword: '' });
      setActiveTab('login');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-white">BYOK Chat</CardTitle>
          <CardDescription className="text-slate-300 pt-1">
            Bring Your Own Keys AI Chat Application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs 
            value={activeTab} 
            onValueChange={(v) => setActiveTab(v as 'login' | 'register')}
            defaultValue="login" 
            className="w-full space-y-6"
          >
            <TabsList className="grid w-full grid-cols-2 bg-slate-700 p-1 h-auto rounded-lg">
              <TabsTrigger
                value="login"
                className="py-2.5 rounded-md text-slate-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="py-2.5 rounded-md text-slate-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
              >
                Create Account
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    disabled={isLoading}
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-300">Password</Label>
                    <a href="#" className="text-sm text-blue-400 hover:text-blue-300 underline">
                      Forgot password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    disabled={isLoading}
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <Button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5" disabled={isLoading}>
                  {isLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
                <div className="text-center mt-4">
                  <span className="text-sm text-slate-400">Don’t have an account?</span>
                  <button type="button" className="ml-2 text-sm text-blue-400 hover:text-blue-300 hover:underline focus:outline-none font-medium" onClick={() => setActiveTab('register')}>
                    Register
                  </button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-slate-300">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-slate-300">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Create a strong password (min 8 characters)"
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-slate-300">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm your password"
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <Button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5"
                    disabled={isLoading}
                  >
                    {isLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
              </form>
              <div className="text-center text-sm mt-4">
                <span className="text-slate-400">Already have an account?</span>
                <button 
                  type="button" 
                  onClick={switchToLogin}
                  className="ml-2 text-sm text-blue-400 hover:text-blue-300 hover:underline focus:outline-none font-medium"
                >
                  Sign In
                </button>
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Redundant links removed, logic is now within each tab's content */}
          
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-slate-800 text-slate-400 rounded-full">Secure & Private</span>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">
              Your data is encrypted and never shared.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
