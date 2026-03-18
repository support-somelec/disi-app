import React from "react";
import { Link } from "wouter";
import { useGetPlans } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilePlus, Clock, CheckCircle2, ShieldCheck, Activity, Search, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Dashboard() {
  const { currentUser } = useAuth();
  
  // Filter plans based on role (for demo purposes, DG sees all, Direction sees theirs, CT sees all pending CT or approved)
  // In a real app, the API would handle this via query params.
  const { data: plans = [], isLoading, error } = useGetPlans();

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'brouillon': return { label: 'Brouillon', variant: 'secondary' as const, icon: Clock };
      case 'en_attente_ct': return { label: 'Attente CT', variant: 'warning' as const, icon: ShieldCheck };
      case 'en_attente_dg': return { label: 'Attente DG', variant: 'info' as const, icon: ShieldCheck };
      case 'approuve': return { label: 'Approuvé', variant: 'success' as const, icon: CheckCircle2 };
      case 'rejete': return { label: 'Rejeté', variant: 'destructive' as const, icon: AlertCircle };
      case 'ouvert': return { label: 'Ouvert', variant: 'success' as const, icon: Activity };
      default: return { label: status, variant: 'default' as const, icon: Activity };
    }
  };

  const stats = {
    total: plans.length,
    pendingCT: plans.filter(p => p.statut === 'en_attente_ct').length,
    pendingDG: plans.filter(p => p.statut === 'en_attente_dg').length,
    active: plans.filter(p => p.statut === 'ouvert').length,
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin text-primary">
          <Activity size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Tableau de Bord</h1>
          <p className="text-muted-foreground mt-1">Gérez et suivez l'état des plans d'action SOMELEC.</p>
        </div>
        
        {currentUser?.role === 'direction' && (
          <Link href="/plans/nouveau" className="inline-flex">
            <Button size="lg" className="gap-2">
              <FilePlus className="w-5 h-5" />
              Nouveau Plan
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-white to-primary/5 border-primary/10">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total des Plans</p>
                <h3 className="text-3xl font-bold text-foreground">{stats.total}</h3>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Activity size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">En attente CT</p>
                <h3 className="text-3xl font-bold text-warning">{stats.pendingCT}</h3>
              </div>
              <div className="p-3 bg-warning/10 rounded-xl text-warning">
                <ShieldCheck size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">En attente DG</p>
                <h3 className="text-3xl font-bold text-accent">{stats.pendingDG}</h3>
              </div>
              <div className="p-3 bg-accent/10 rounded-xl text-accent">
                <ShieldCheck size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Plans Ouverts</p>
                <h3 className="text-3xl font-bold text-success">{stats.active}</h3>
              </div>
              <div className="p-3 bg-success/10 rounded-xl text-success">
                <CheckCircle2 size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Liste des Plans d'Action</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Rechercher..." 
                className="pl-9 pr-4 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-semibold">Titre & Réf</th>
                <th className="px-6 py-4 font-semibold">Direction</th>
                <th className="px-6 py-4 font-semibold">Date Début</th>
                <th className="px-6 py-4 font-semibold">Durée</th>
                <th className="px-6 py-4 font-semibold">Statut</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Aucun plan d'action trouvé.
                  </td>
                </tr>
              ) : (
                plans.map((plan) => {
                  const status = getStatusConfig(plan.statut);
                  const StatusIcon = status.icon;
                  return (
                    <tr key={plan.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{plan.titre}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">#{plan.id.toString().padStart(4, '0')}</div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{plan.directionNom || `Dir. ${plan.directionId}`}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {plan.dateDebut ? format(new Date(plan.dateDebut), 'dd MMM yyyy', { locale: fr }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{plan.duree} jours</td>
                      <td className="px-6 py-4">
                        <Badge variant={status.variant} className="gap-1.5 py-1">
                          <StatusIcon className="w-3.5 h-3.5" />
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/plans/${plan.id}`}>
                          <Button variant="ghost" size="sm" className="font-semibold">
                            Consulter
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
