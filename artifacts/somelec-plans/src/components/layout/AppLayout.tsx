import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { LayoutDashboard, FilePlus, User, LogOut, Shield, ChevronDown, BarChart2, Users, KeyRound, Eye, EyeOff, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNext, setShowNext] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (next.length < 6) { setError("Le nouveau mot de passe doit contenir au moins 6 caractères."); return; }
    if (next !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const result = await changePassword(current, next);
    setLoading(false);
    if (result.success) { setSuccess(true); setTimeout(onClose, 1500); }
    else setError(result.error ?? "Erreur.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Changer le mot de passe</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-green-700 font-medium">Mot de passe modifié avec succès !</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe actuel</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  required
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showNext ? "text" : "password"}
                  required
                  value={next}
                  onChange={e => setNext(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="w-full pr-10 pl-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button type="button" onClick={() => setShowNext(!showNext)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                <X className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Modifier
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { currentUser, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [showChangePassword, setShowChangePassword] = React.useState(false);

  const navItems = [
    { href: "/", label: "Tableau de Bord", icon: LayoutDashboard },
    { href: "/plans/nouveau", label: "Nouveau Plan", icon: FilePlus, roles: ["direction"] },
    { href: "/analyse", label: "Analyse", icon: BarChart2, roles: ["directeur_general", "dga"] },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, roles: ["admin"] },
  ];

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "direction": return "Direction";
      case "controle_technique": return "Contrôle Technique";
      case "directeur_general": return "Directeur Général";
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "directeur_general": return "text-purple-600 bg-purple-50";
      case "controle_technique": return "text-amber-600 bg-amber-50";
      default: return "text-blue-600 bg-blue-50";
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-white/90 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <img src="/logo.png" alt="SOMELEC" className="h-9 w-9 object-contain group-hover:scale-105 transition-transform" />
              <div className="flex flex-col">
                <span className="font-bold text-xl leading-none text-primary tracking-tight">SOMELEC</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Plans d'Action</span>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <nav className="hidden md:flex gap-1">
                {navItems
                  .filter(item => !item.roles || (currentUser && item.roles.includes(currentUser.role)))
                  .map((item) => {
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

              <div className="h-8 w-px bg-border hidden md:block" />

              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-2.5 py-1.5 pl-2 pr-3 rounded-full border border-border hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", getRoleColor(currentUser?.role ?? ""))}>
                    <User className="h-4 w-4" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      {currentUser?.prenom} {currentUser?.nom}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {currentUser ? getRoleLabel(currentUser.role) : ""}
                    </p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isMenuOpen && "rotate-180")} />
                </button>

                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-border/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="p-4 border-b border-border/50 bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", getRoleColor(currentUser?.role ?? ""))}>
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {currentUser?.prenom} {currentUser?.nom}
                            </p>
                            <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", getRoleColor(currentUser?.role ?? ""))}>
                            <Shield className="h-3 w-3" />
                            {currentUser ? getRoleLabel(currentUser.role) : ""}
                          </span>
                          {currentUser?.directionNom && (
                            <p className="text-xs text-muted-foreground mt-1">{currentUser.directionNom}</p>
                          )}
                        </div>
                      </div>

                      <div className="p-2">
                        <button
                          onClick={() => { setIsMenuOpen(false); setShowChangePassword(true); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                        >
                          <KeyRound className="h-4 w-4 text-gray-500" />
                          Changer le mot de passe
                        </button>
                        <button
                          onClick={() => { setIsMenuOpen(false); handleLogout(); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                        >
                          <LogOut className="h-4 w-4" />
                          Se déconnecter
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {showChangePassword && <ChangePasswordDialog onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
