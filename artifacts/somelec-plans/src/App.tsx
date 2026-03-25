import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import CreatePlan from "@/pages/CreatePlan";
import PlanDetails from "@/pages/PlanDetails";
import Analytics from "@/pages/Analytics";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AdminUsers from "@/pages/AdminUsers";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  },
});

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/">
        {isAuthenticated ? (
          <AppLayout><Dashboard /></AppLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/plans/nouveau">
        {isAuthenticated ? (
          <AppLayout><CreatePlan /></AppLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/plans/:id">
        {isAuthenticated ? (
          <AppLayout><PlanDetails /></AppLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/analyse">
        {isAuthenticated ? (
          <AppLayout><Analytics /></AppLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/admin/utilisateurs">
        {isAuthenticated ? (
          <AppLayout><AdminUsers /></AppLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
