import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Zap, LayoutDashboard, FilePlus, ChevronDown, User, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { currentUser, availableUsers, setCurrentUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const navItems = [
    { href: "/", label: "Tableau de Bord", icon: LayoutDashboard },
    { href: "/plans/nouveau", label: "Nouveau Plan", icon: FilePlus, roles: ["direction"] },
  ];

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "direction": return "Direction";
      case "controle_technique": return "Contrôle Technique";
      case "directeur_general": return "Directeur Général";
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="bg-primary p-2 rounded-xl text-white shadow-md group-hover:scale-105 transition-transform">
                <Zap className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-xl leading-none text-primary tracking-tight">SOMELEC</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Plans d'Action</span>
              </div>
            </Link>

            <div className="flex items-center gap-6">
              <nav className="hidden md:flex gap-1">
                {navItems.filter(item => !item.roles || (currentUser && item.roles.includes(currentUser.role))).map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive 
                          ? "bg-primary/10 text-primary" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="h-8 w-px bg-border hidden md:block"></div>

              {/* User Switcher (Simulation) */}
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-3 p-1.5 pr-3 rounded-full border border-border hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-semibold text-foreground leading-tight">{currentUser?.prenom} {currentUser?.nom}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{currentUser ? getRoleLabel(currentUser.role) : "Non connecté"}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
                </button>

                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-border/50 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Simuler un utilisateur
                      </div>
                      <div className="space-y-1 mt-1">
                        {availableUsers.map(user => (
                          <button
                            key={user.id}
                            onClick={() => { setCurrentUser(user); setIsMenuOpen(false); }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-sm flex flex-col transition-colors",
                              currentUser?.id === user.id ? "bg-primary/5 text-primary" : "hover:bg-muted text-foreground"
                            )}
                          >
                            <span className="font-medium">{user.prenom} {user.nom}</span>
                            <span className="text-xs opacity-70">{getRoleLabel(user.role)} {user.directionNom ? `- ${user.directionNom}` : ''}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
