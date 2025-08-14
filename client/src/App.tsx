import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Games from "@/pages/games";
import TopUp from "@/pages/topup";
import ColorGame from "@/pages/color-game";
import AviatorGame from "@/pages/aviator-game";
import OtpLogin from "@/pages/otp-login";
import PaymentTopup from "@/pages/payment-topup";
import Withdrawal from "@/pages/withdrawal";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/otp-login" component={OtpLogin} />
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/games" component={Games} />
          <Route path="/topup" component={TopUp} />
          <Route path="/color-game" component={ColorGame} />
          <Route path="/aviator-game" component={AviatorGame} />
          <Route path="/payment-topup" component={PaymentTopup} />
          <Route path="/withdrawal" component={Withdrawal} />
          <Route path="/admin/login" component={AdminLogin} />
          <Route path="/admin/dashboard" component={AdminDashboard} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
