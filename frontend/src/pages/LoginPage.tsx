import { AuthModal } from "@/components/auth/AuthModal";
import { useAppContext } from "@/context/AppContext";
import { Navigate } from "react-router-dom";

export function LoginPage() {
  const { isAuthenticated, handleAuthSuccess } = useAppContext();

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AuthModal onAuthSuccess={handleAuthSuccess} />
    </div>
  );
}
