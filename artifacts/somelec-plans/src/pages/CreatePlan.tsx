import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useCreatePlan, useGetDirections, useAddMoyen, useAddAttachment, useValidatePlan } from "@workspace/api-client-react";
import type { Plan, CreateMoyenRequestCategorie } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowRight, ArrowLeft, CheckCircle2, UploadCloud, Plus, Trash2, FilePlus } from "lucide-react";

const STEPS = [
  { id: 1, title: "Informations" },
  { id: 2, title: "Moyens" },
  { id: 3, title: "Soumettre" }
];

export default function CreatePlan() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [createdPlan, setCreatedPlan] = useState<Plan | null>(null);

  const { data: directions } = useGetDirections();
  const createPlanMutation = useCreatePlan();
  const addMoyenMutation = useAddMoyen();
  const addAttachmentMutation = useAddAttachment();
  const validatePlanMutation = useValidatePlan();

  // Step 1 State
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    dateDebut: "",
    duree: "",
    directionId: currentUser?.directionId?.toString() || ""
  });
  const [attachments, setAttachments] = useState<Array<{ file: File; base64: string }>>([]);

  // Step 2 State
  const [moyens, setMoyens] = useState<Array<{ categorie: string; description: string; budget: string; quantite: string; unite: string }>>([]);
  const [currentMoyen, setCurrentMoyen] = useState({ categorie: "materiel", description: "", budget: "", quantite: "", unite: "" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAttachments(prev => [...prev, { file, base64: event.target!.result!.toString() }]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const plan = await createPlanMutation.mutateAsync({
        data: {
          titre: formData.titre,
          description: formData.description,
          dateDebut: formData.dateDebut,
          duree: parseInt(formData.duree, 10),
          directionId: parseInt(formData.directionId, 10),
          createdById: currentUser.id
        }
      });

      // Upload attachments immediately after plan creation
      for (const att of attachments) {
        try {
          await addAttachmentMutation.mutateAsync({
            id: plan.id,
            data: { nom: att.file.name, type: att.file.type, taille: att.file.size, data: att.base64 }
          });
        } catch (err) {
          console.error("Failed to upload attachment", String(err));
        }
      }

      setCreatedPlan(plan);
      setStep(2);
    } catch (err) {
      console.error("Failed to create plan", err);
    }
  };

  const handleAddMoyen = async () => {
    if (!createdPlan || !currentMoyen.description || !currentMoyen.budget) return;
    try {
      await addMoyenMutation.mutateAsync({
        id: createdPlan.id,
        data: {
          categorie: currentMoyen.categorie as CreateMoyenRequestCategorie,
          description: currentMoyen.description,
          budget: parseFloat(currentMoyen.budget),
          quantite: currentMoyen.quantite ? parseInt(currentMoyen.quantite, 10) : undefined,
          unite: currentMoyen.unite || undefined
        }
      });
      setMoyens([...moyens, { ...currentMoyen }]);
      setCurrentMoyen({ categorie: "materiel", description: "", budget: "", quantite: "", unite: "" });
    } catch (err) {
      console.error("Failed to add moyen", err);
    }
  };

  const handleFinish = async () => {
    if (!createdPlan || !currentUser) return;
    try {
      await validatePlanMutation.mutateAsync({
        id: createdPlan.id,
        data: { action: "approuver", validatedById: currentUser.id }
      });
    } catch (err) {
      console.error("Failed to submit plan", String(err));
    }
    setLocation("/");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">Nouveau Plan d'Action</h1>
        <p className="text-muted-foreground mt-1">Créez un nouveau plan et définissez ses besoins.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10 rounded-full"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-500" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>

        {STEPS.map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-2 bg-background px-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${
              step >= s.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground border-2 border-border"
            }`}>
              {step > s.id ? <CheckCircle2 className="w-5 h-5" /> : s.id}
            </div>
            <span className={`text-xs font-semibold ${step >= s.id ? "text-primary" : "text-muted-foreground"}`}>{s.title}</span>
          </div>
        ))}
      </div>

      <Card className="border-t-4 border-t-primary">
        <CardContent className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {/* STEP 1 — Informations + Pièces jointes */}
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                onSubmit={handleCreatePlan}
                className="space-y-6"
              >
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-sm font-semibold text-foreground">Titre du Plan <span className="text-destructive">*</span></label>
                    <Input required placeholder="Ex: Maintenance des turbines" value={formData.titre} onChange={e => setFormData({ ...formData, titre: e.target.value })} />
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-sm font-semibold text-foreground">Description <span className="text-destructive">*</span></label>
                    <textarea
                      required
                      className="w-full min-h-[120px] rounded-xl border-2 border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      placeholder="Détaillez les objectifs de l'action..."
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  {/* Pièces jointes — immediately below Description */}
                  <div className="sm:col-span-2 space-y-3">
                    <label className="text-sm font-semibold text-foreground">Pièces Jointes <span className="text-xs font-normal text-muted-foreground">(optionnel)</span></label>
                    <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl p-6 text-center bg-muted/10 relative cursor-pointer">
                      <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <UploadCloud className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">Cliquez ou glissez un fichier</p>
                      <p className="text-xs text-muted-foreground mt-0.5">PDF, Excel, Images (Max 10MB)</p>
                    </div>
                    {attachments.length > 0 && (
                      <ul className="space-y-2">
                        {attachments.map((att, i) => (
                          <li key={i} className="p-3 border rounded-xl flex items-center justify-between bg-white shadow-sm">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="p-2 bg-secondary rounded-lg"><FilePlus className="w-4 h-4 text-primary" /></div>
                              <span className="text-sm font-medium truncate">{att.file.name}</span>
                            </div>
                            <button type="button" onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Direction Responsable <span className="text-destructive">*</span></label>
                    <select
                      required
                      className="w-full h-11 rounded-xl border-2 border-border bg-background px-4 text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      value={formData.directionId}
                      onChange={e => setFormData({ ...formData, directionId: e.target.value })}
                    >
                      <option value="">Sélectionner une direction</option>
                      {directions?.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Date de Début <span className="text-destructive">*</span></label>
                    <Input required type="date" value={formData.dateDebut} onChange={e => setFormData({ ...formData, dateDebut: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Durée (jours) <span className="text-destructive">*</span></label>
                    <Input required type="number" min="1" placeholder="Ex: 30" value={formData.duree} onChange={e => setFormData({ ...formData, duree: e.target.value })} />
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <Button type="submit" size="lg" isLoading={createPlanMutation.isPending || addAttachmentMutation.isPending} className="w-full sm:w-auto">
                    Créer le plan & Continuer <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              </motion.form>
            )}

            {/* STEP 2 — Moyens */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="bg-muted/30 p-6 rounded-2xl border border-border/50 space-y-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" /> Ajouter un moyen nécessaire
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Catégorie</label>
                      <select
                        className="w-full h-10 rounded-lg border-2 border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
                        value={currentMoyen.categorie} onChange={e => setCurrentMoyen({ ...currentMoyen, categorie: e.target.value })}
                      >
                        <option value="materiel">Matériel</option>
                        <option value="carburant">Carburant</option>
                        <option value="logement">Logement</option>
                        <option value="logistique">Logistique</option>
                        <option value="prime">Prime</option>
                        <option value="indemnite_journaliere">Indemnité Journalière</option>
                      </select>
                    </div>
                    <div className="lg:col-span-2 space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
                      <Input placeholder="Détails du besoin..." value={currentMoyen.description} onChange={e => setCurrentMoyen({ ...currentMoyen, description: e.target.value })} className="h-10 rounded-lg" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Budget (MRU)</label>
                      <Input type="number" placeholder="0.00" value={currentMoyen.budget} onChange={e => setCurrentMoyen({ ...currentMoyen, budget: e.target.value })} className="h-10 rounded-lg" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Quantité (Opt.)</label>
                      <Input type="number" placeholder="0" value={currentMoyen.quantite} onChange={e => setCurrentMoyen({ ...currentMoyen, quantite: e.target.value })} className="h-10 rounded-lg" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Unité (Opt.)</label>
                      <Input placeholder="Ex: L, Jours, Pcs" value={currentMoyen.unite} onChange={e => setCurrentMoyen({ ...currentMoyen, unite: e.target.value })} className="h-10 rounded-lg" />
                    </div>
                  </div>
                  <Button
                    type="button" variant="secondary" className="w-full mt-2"
                    onClick={handleAddMoyen}
                    disabled={!currentMoyen.description || !currentMoyen.budget || addMoyenMutation.isPending}
                    isLoading={addMoyenMutation.isPending}
                  >
                    Ajouter à la liste
                  </Button>
                </div>

                {moyens.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground border-b pb-2">Moyens ajoutés ({moyens.length})</h4>
                    <ul className="divide-y divide-border/50 border rounded-xl overflow-hidden">
                      {moyens.map((m, i) => (
                        <li key={i} className="p-4 flex justify-between items-center bg-white hover:bg-muted/20 transition-colors">
                          <div>
                            <div className="font-medium text-sm text-foreground">{m.description}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 capitalize">{m.categorie.replace("_", " ")} {m.quantite && `• ${m.quantite} ${m.unite}`}</div>
                          </div>
                          <div className="font-semibold text-primary text-sm">{Number(m.budget).toLocaleString("fr-MR")} MRU</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-6 flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-2 w-4 h-4" /> Retour</Button>
                  <Button type="button" onClick={() => setStep(3)}>Continuer <ArrowRight className="ml-2 w-4 h-4" /></Button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 — Confirmation */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="bg-success/5 border border-success/20 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Prêt à soumettre</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Le plan <strong>"{createdPlan?.titre}"</strong> sera envoyé au Contrôle Technique pour validation.
                    {moyens.length > 0 && <> Il contient <strong>{moyens.length} moyen{moyens.length > 1 ? "s" : ""}</strong>.</>}
                    {attachments.length > 0 && <> <strong>{attachments.length} pièce{attachments.length > 1 ? "s" : ""} jointe{attachments.length > 1 ? "s" : ""}</strong> ont été ajoutées.</>}
                  </p>
                  {createdPlan?.reference && (
                    <div className="inline-block bg-white border border-border rounded-lg px-4 py-2">
                      <span className="text-xs text-muted-foreground">Référence : </span>
                      <span className="font-mono font-bold text-primary">{createdPlan.reference}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-between border-t mt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-2 w-4 h-4" /> Retour</Button>
                  <Button
                    type="button" size="lg"
                    className="bg-success hover:bg-success/90 text-white"
                    onClick={handleFinish}
                    isLoading={validatePlanMutation.isPending}
                  >
                    Soumettre le Plan <CheckCircle2 className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
