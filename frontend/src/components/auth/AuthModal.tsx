
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">BYOK Chat</CardTitle>
          <CardDescription className="text-slate-400">
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
            <TabsList className="grid w-full grid-cols-2 bg-slate-700/50 p-1 h-auto rounded-lg">
              <TabsTrigger 
                value="login" 
                className="py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger 
                value="register" 
                className="py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
              >
                Create Account
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    <a href="#" className="ml-auto inline-block text-sm underline">
                      Forgot your password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <Button className="w-full flex items-center justify-center gap-2" disabled={isLoading}>
                  {isLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
                <div className="text-center mt-2">
                  <span className="text-sm text-slate-400">Don’t have an account?</span>
                  <button type="button" className="ml-2 text-blue-400 hover:underline focus:outline-none" onClick={() => setActiveTab('register')}>Register</button>
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
                    placeholder="Enter your email"
                    className="bg-slate-700 border-slate-600 text-white"
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
                    placeholder="Create a password (min 8 characters)"
                    className="bg-slate-700 border-slate-600 text-white"
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
                    className="bg-slate-700 border-slate-600 text-white focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <Button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2"
                    disabled={isLoading}
                  >
                    {isLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                    {isLoading ? 'Registering...' : 'Create account'}
                  </Button>
              </form>
              <div className="text-center text-sm">
                <button 
                  type="button" 
                  onClick={switchToLogin}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 text-center text-sm">
            {activeTab === 'login' ? (
              <p className="text-slate-400">
                Don't have an account?{' '}
                <button 
                  type="button" 
                  onClick={switchToRegister}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-slate-400">
                Already have an account?{' '}
                <button 
                  type="button" 
                  onClick={switchToLogin}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800 text-slate-400">Secure & Private</span>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-500">
              Your data is encrypted and never shared with third parties.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
