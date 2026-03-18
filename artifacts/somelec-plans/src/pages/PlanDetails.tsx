import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetPlan, useGetPlanMoyens, useGetPlanAttachments, useValidatePlan } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import { Calendar, Building, User, Clock, CheckCircle2, FileText, Activity, AlertCircle, FileDigit, Download, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function PlanDetails() {
  const [, params] = useRoute("/plans/:id");
  const id = parseInt(params?.id || "0", 10);
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();

  const { data: plan, isLoading, refetch: refetchPlan } = useGetPlan(id);
  const { data: moyens } = useGetPlanMoyens(id);
  const { data: attachments } = useGetPlanAttachments(id);
  const validateMutation = useValidatePlan();

  const [commentaire, setCommentaire] = useState("");

  if (isLoading || !plan) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin text-primary"><Activity size={48} /></div>
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'brouillon': return { label: 'Brouillon', variant: 'secondary' as const, color: 'text-gray-500' };
      case 'en_attente_ct': return { label: 'En attente CT', variant: 'warning' as const, color: 'text-warning' };
      case 'en_attente_dg': return { label: 'En attente DG', variant: 'info' as const, color: 'text-accent' };
      case 'approuve': return { label: 'Approuvé', variant: 'success' as const, color: 'text-success' };
      case 'rejete': return { label: 'Rejeté', variant: 'destructive' as const, color: 'text-destructive' };
      case 'ouvert': return { label: 'Plan Ouvert', variant: 'success' as const, color: 'text-success' };
      default: return { label: status, variant: 'default' as const, color: 'text-primary' };
    }
  };

  const statusConfig = getStatusConfig(plan.statut);
  const totalBudget = moyens?.reduce((sum, m) => sum + Number(m.budget), 0) || plan.budgetTotal || 0;

  const handleValidate = async (action: 'approuver' | 'rejeter') => {
    if (!currentUser) return;
    try {
      await validateMutation.mutateAsync({
        id,
        data: {
          action,
          validatedById: currentUser.id,
          commentaire: commentaire || undefined
        }
      });
      setCommentaire("");
      refetchPlan();
    } catch (err) {
      console.error("Validation failed", err);
    }
  };

  // Determine if current user can take action
  const canValidateCT = currentUser?.role === 'controle_technique' && plan.statut === 'en_attente_ct';
  const canValidateDG = currentUser?.role === 'directeur_general' && (plan.statut === 'en_attente_dg' || plan.statut === 'approuve'); // Sometimes DG opens it

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        
        <div className="space-y-4 relative z-10">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-muted-foreground border-border/60">
              #{plan.id.toString().padStart(4, '0')}
            </Badge>
            <Badge variant={statusConfig.variant} className="px-3 py-1 text-sm shadow-sm">{statusConfig.label}</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground leading-tight">{plan.titre}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5"><Building className="w-4 h-4" /> {plan.directionNom || `Direction ${plan.directionId}`}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Début: {format(new Date(plan.dateDebut), 'dd MMM yyyy', { locale: fr })}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {plan.duree} Jours</span>
          </div>
        </div>

        <div className="bg-muted/30 p-4 rounded-xl border border-border/50 min-w-[200px] text-right relative z-10">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Budget Total Estimé</div>
          <div className="text-3xl font-display font-bold text-primary">{formatCurrency(totalBudget)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Description du Plan</CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-foreground leading-relaxed whitespace-pre-wrap">
              {plan.description}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/50 pb-4 flex flex-row justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Moyens Nécessaires</CardTitle>
              <Badge variant="secondary">{moyens?.length || 0} éléments</Badge>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">Catégorie</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Qté</th>
                    <th className="px-6 py-3 text-right">Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {moyens?.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Aucun moyen défini.</td></tr>
                  ) : (
                    moyens?.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/10">
                        <td className="px-6 py-4 font-medium capitalize text-foreground">{m.categorie.replace('_', ' ')}</td>
                        <td className="px-6 py-4 text-muted-foreground">{m.description}</td>
                        <td className="px-6 py-4 text-muted-foreground">{m.quantite ? `${m.quantite} ${m.unite || ''}` : '-'}</td>
                        <td className="px-6 py-4 text-right font-semibold text-primary">{formatCurrency(Number(m.budget))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2"><FileDigit className="w-5 h-5 text-primary" /> Pièces Jointes</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {attachments?.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucune pièce jointe.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {attachments?.map((att) => (
                    <li key={att.id} className="flex items-center gap-3 p-3 border rounded-xl hover:shadow-md transition-shadow bg-white">
                      <div className="bg-primary/10 text-primary p-3 rounded-lg"><FileText className="w-6 h-6" /></div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-semibold text-foreground truncate">{att.nom}</p>
                        <p className="text-xs text-muted-foreground uppercase">{att.type.split('/')[1] || 'Fichier'} • {(Number(att.taille || 0) / 1024).toFixed(0)} KB</p>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary">
                        <Download className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          
          {/* Action Panel for Approvers */}
          {(canValidateCT || canValidateDG) && (
            <Card className="border-warning/30 bg-warning/5 shadow-lg shadow-warning/5">
              <CardHeader className="border-b border-warning/20 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-warning-foreground font-bold">
                  <ShieldCheck className="w-5 h-5" /> 
                  Action Requise
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <p className="text-sm text-foreground font-medium">Ce plan est en attente de votre validation en tant que <strong>{currentUser.role.replace('_', ' ')}</strong>.</p>
                <textarea 
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Commentaire (obligatoire en cas de rejet)..."
                  rows={3}
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button 
                    variant="destructive" 
                    className="flex-1" 
                    onClick={() => handleValidate('rejeter')}
                    disabled={validateMutation.isPending || !commentaire}
                    isLoading={validateMutation.isPending}
                  >
                    Rejeter
                  </Button>
                  <Button 
                    className="flex-1 bg-success hover:bg-success/90 text-white" 
                    onClick={() => handleValidate('approuver')}
                    disabled={validateMutation.isPending}
                    isLoading={validateMutation.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approuver
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rejection Note */}
          {plan.statut === 'rejete' && plan.commentaireRejet && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-destructive">Motif du rejet</h4>
                    <p className="text-sm text-foreground mt-1 leading-relaxed">{plan.commentaireRejet}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Workflow Timeline */}
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg">Circuit de Validation</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border">
                
                {/* Step 1: Direction */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-success text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border shadow-sm">
                    <h4 className="font-bold text-sm text-foreground">Direction</h4>
                    <p className="text-xs text-muted-foreground mt-1">Création du plan d'action</p>
                  </div>
                </div>

                {/* Step 2: Controle Technique */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors ${
                    plan.statut === 'brouillon' ? 'bg-muted text-muted-foreground' :
                    plan.statut === 'en_attente_ct' ? 'bg-warning text-white animate-pulse' :
                    plan.statut === 'rejete' ? 'bg-destructive text-white' :
                    'bg-success text-white'
                  }`}>
                    {['brouillon', 'en_attente_ct'].includes(plan.statut) ? <Clock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border shadow-sm">
                    <h4 className="font-bold text-sm text-foreground">Contrôle Technique</h4>
                    <p className="text-xs text-muted-foreground mt-1">Vérification technique & financière</p>
                  </div>
                </div>

                {/* Step 3: Directeur General */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors ${
                    ['brouillon', 'en_attente_ct', 'rejete'].includes(plan.statut) ? 'bg-muted text-muted-foreground' :
                    plan.statut === 'en_attente_dg' ? 'bg-accent text-white animate-pulse' :
                    'bg-success text-white'
                  }`}>
                    {['brouillon', 'en_attente_ct', 'en_attente_dg', 'rejete'].includes(plan.statut) ? <Clock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border shadow-sm">
                    <h4 className="font-bold text-sm text-foreground">Directeur Général</h4>
                    <p className="text-xs text-muted-foreground mt-1">Approbation finale</p>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
