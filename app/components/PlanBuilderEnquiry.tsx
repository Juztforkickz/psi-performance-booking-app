"use client";

import { FormEvent, useMemo, useState, type ReactNode } from "react";
import {
  BUDGET_OPTIONS,
  INTENDED_USE_OPTIONS,
  PLAN_BUILD_AREAS,
  PLANNING_STAGE_OPTIONS,
  PRIORITY_OPTIONS,
  TIMING_OPTIONS,
  type PlanAreaId,
  type PlanBuilderOption,
} from "../lib/plan-builder";

type BuilderState = {
  firstName: string; lastName: string; email: string; mobile: string;
  vehicleYear: string; vehicleMake: string; vehicleModel: string; registration: string;
  selectedAreas: PlanAreaId[];
  areaSelections: Partial<Record<PlanAreaId, string>>;
  areaNotes: Partial<Record<PlanAreaId, string>>;
  intendedUse: string; priority: string; planningStage: string; timing: string;
  budget: string; budgetDetails: string; goalNotes: string; currentSetup: string;
};

const INITIAL_BUILDER: BuilderState = {
  firstName: "", lastName: "", email: "", mobile: "",
  vehicleYear: "", vehicleMake: "", vehicleModel: "", registration: "",
  selectedAreas: [], areaSelections: {}, areaNotes: {}, intendedUse: "", priority: "",
  planningStage: "", timing: "", budget: "", budgetDetails: "", goalNotes: "", currentSetup: "",
};

function labelFor(options: readonly PlanBuilderOption[], value: string) {
  return options.find((option) => option.value === value)?.label || "Not chosen";
}

export function PlanBuilderEnquiry() {
  const [builder, setBuilder] = useState<BuilderState>(INITIAL_BUILDER);
  const [error, setError] = useState("");
  const selectedAreaDetails = useMemo(
    () => PLAN_BUILD_AREAS.filter((area) => builder.selectedAreas.includes(area.id)),
    [builder.selectedAreas],
  );

  const update = <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => {
    setError("");
    setBuilder((current) => ({ ...current, [key]: value }));
  };

  const toggleArea = (areaId: PlanAreaId) => {
    setError("");
    setBuilder((current) => {
      if (!current.selectedAreas.includes(areaId)) return { ...current, selectedAreas: [...current.selectedAreas, areaId] };
      const areaSelections = { ...current.areaSelections };
      const areaNotes = { ...current.areaNotes };
      delete areaSelections[areaId];
      delete areaNotes[areaId];
      return { ...current, selectedAreas: current.selectedAreas.filter((item) => item !== areaId), areaSelections, areaNotes };
    });
  };

  const updateArea = (areaId: PlanAreaId, value: string) => {
    setError("");
    setBuilder((current) => ({
      ...current,
      areaSelections: { ...current.areaSelections, [areaId]: value },
      areaNotes: value === "other" ? current.areaNotes : { ...current.areaNotes, [areaId]: "" },
    }));
  };

  const openEmailDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!builder.selectedAreas.length) {
      setError("Choose at least one build area before continuing.");
      document.getElementById("plan-builder-areas")?.focus();
      return;
    }
    const incompleteArea = selectedAreaDetails.find((area) => {
      const choice = builder.areaSelections[area.id] || "";
      return !choice || (choice === "other" && !builder.areaNotes[area.id]?.trim());
    });
    if (incompleteArea) {
      setError(`Choose what you would like to discuss for ${incompleteArea.label}.`);
      document.getElementById(`plan-area-${incompleteArea.id}`)?.focus();
      return;
    }

    const areaLines = selectedAreaDetails.map((area) => {
      const choice = builder.areaSelections[area.id] || "";
      const note = choice === "other" ? ` — ${builder.areaNotes[area.id]?.trim()}` : "";
      return `• ${area.label}: ${labelFor(area.options, choice)}${note}`;
    });
    const vehicle = `${builder.vehicleYear} ${builder.vehicleMake} ${builder.vehicleModel}`.replace(/\s+/gu, " ").trim();
    const lines = [
      "PSI PLAN BUILDER ENQUIRY",
      `Customer: ${builder.firstName.trim()} ${builder.lastName.trim()}`,
      `Email: ${builder.email.trim()}`,
      `Mobile: ${builder.mobile.trim()}`,
      `Vehicle: ${vehicle}`,
      `Registration: ${builder.registration.trim().toUpperCase()}`,
      "", "Build areas:", ...areaLines, "",
      `Intended use: ${labelFor(INTENDED_USE_OPTIONS, builder.intendedUse)}`,
      `Main priority: ${labelFor(PRIORITY_OPTIONS, builder.priority)}`,
      `Planning stage: ${labelFor(PLANNING_STAGE_OPTIONS, builder.planningStage)}`,
      `Timing: ${labelFor(TIMING_OPTIONS, builder.timing)}`,
      `Budget direction: ${labelFor(BUDGET_OPTIONS, builder.budget)}`,
      builder.budget === "defined" && builder.budgetDetails.trim() ? `Budget note: ${builder.budgetDetails.trim()}` : "",
      builder.goalNotes.trim() ? `Goal or concern: ${builder.goalNotes.trim()}` : "",
      builder.currentSetup.trim() ? `Current setup or parts: ${builder.currentSetup.trim()}` : "",
      "", "Please review this brief with me. I understand PSI must separately confirm suitability, scope, pricing, availability and timing.",
    ].filter(Boolean);
    const subject = encodeURIComponent(`PSI Plan Builder enquiry — ${vehicle || builder.registration.toUpperCase()}`);
    window.location.href = `mailto:info@psiperformance.com.au?subject=${subject}&body=${encodeURIComponent(lines.join("\n"))}`;
  };

  return (
    <section className="plan-builder-section" id="plan-builder" aria-labelledby="plan-builder-heading">
      <div className="plan-builder-heading">
        <div><p className="eyebrow">Plan Builder</p><h2 id="plan-builder-heading">One goal. Measured stages.</h2></div>
        <p>Build a clear project brief with the same choices as the PSI app, then open it as a ready-to-review email enquiry.</p>
      </div>

      <form className="plan-builder-form" onSubmit={openEmailDraft}>
        <BuilderStep number="01" title="You and your vehicle" copy="Tell PSI who the project belongs to and which vehicle the plan is for.">
          <div className="plan-builder-field-grid">
            <BuilderField label="First name"><input value={builder.firstName} onChange={(e) => update("firstName", e.target.value)} maxLength={60} required /></BuilderField>
            <BuilderField label="Last name"><input value={builder.lastName} onChange={(e) => update("lastName", e.target.value)} maxLength={60} required /></BuilderField>
            <BuilderField label="Email"><input type="email" value={builder.email} onChange={(e) => update("email", e.target.value)} maxLength={254} required /></BuilderField>
            <BuilderField label="Mobile"><input type="tel" value={builder.mobile} onChange={(e) => update("mobile", e.target.value)} maxLength={32} required /></BuilderField>
            <BuilderField label="Year"><input type="number" min="1900" max={new Date().getFullYear() + 1} value={builder.vehicleYear} onChange={(e) => update("vehicleYear", e.target.value)} required /></BuilderField>
            <BuilderField label="Make"><input value={builder.vehicleMake} onChange={(e) => update("vehicleMake", e.target.value)} maxLength={60} required /></BuilderField>
            <BuilderField label="Model"><input value={builder.vehicleModel} onChange={(e) => update("vehicleModel", e.target.value)} maxLength={80} required /></BuilderField>
            <BuilderField label="Registration"><input value={builder.registration} onChange={(e) => update("registration", e.target.value.toUpperCase())} maxLength={20} required /></BuilderField>
          </div>
        </BuilderStep>

        <BuilderStep number="02" title="Choose build areas" copy="Choose every area you want to discuss. Select as many as your project needs.">
          <div className="plan-area-grid" id="plan-builder-areas" tabIndex={-1}>
            {PLAN_BUILD_AREAS.map((area, index) => {
              const selected = builder.selectedAreas.includes(area.id);
              return (
                <button key={area.id} type="button" className={selected ? "plan-area-card selected" : "plan-area-card"} onClick={() => toggleArea(area.id)} aria-pressed={selected}>
                  <span>0{index + 1}</span><strong>{area.label}</strong><small>{area.detail}</small><b aria-hidden="true">{selected ? "✓" : "+"}</b>
                </button>
              );
            })}
          </div>
          {selectedAreaDetails.length > 0 && (
            <div className="plan-area-details">
              {selectedAreaDetails.map((area) => (
                <div className="plan-area-detail" key={area.id}>
                  <BuilderField label={area.label}>
                    <select id={`plan-area-${area.id}`} value={builder.areaSelections[area.id] || ""} onChange={(e) => updateArea(area.id, e.target.value)} required>
                      <option value="">What would you like to discuss?</option>
                      {area.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                    </select>
                  </BuilderField>
                  {builder.areaSelections[area.id] === "other" && (
                    <BuilderField label="Other details"><textarea value={builder.areaNotes[area.id] || ""} onChange={(e) => setBuilder((current) => ({ ...current, areaNotes: { ...current.areaNotes, [area.id]: e.target.value } }))} rows={3} maxLength={240} required /></BuilderField>
                  )}
                </div>
              ))}
            </div>
          )}
        </BuilderStep>

        <BuilderStep number="03" title="Shape the plan" copy="Give PSI the direction needed for a productive first conversation.">
          <div className="plan-builder-shape-grid">
            <BuilderSelect label="Intended use" value={builder.intendedUse} options={INTENDED_USE_OPTIONS} onChange={(value) => update("intendedUse", value)} />
            <BuilderSelect label="Main priority" value={builder.priority} options={PRIORITY_OPTIONS} onChange={(value) => update("priority", value)} />
            <BuilderSelect label="Planning stage" value={builder.planningStage} options={PLANNING_STAGE_OPTIONS} onChange={(value) => update("planningStage", value)} />
            <BuilderSelect label="Timing" value={builder.timing} options={TIMING_OPTIONS} onChange={(value) => update("timing", value)} />
            <BuilderSelect label="Budget direction" value={builder.budget} options={BUDGET_OPTIONS} onChange={(value) => update("budget", value)} />
            {builder.budget === "defined" && <BuilderField label="Budget note"><input value={builder.budgetDetails} onChange={(e) => update("budgetDetails", e.target.value)} maxLength={160} /></BuilderField>}
          </div>
          <div className="plan-builder-notes-grid">
            <BuilderField label="Goal or concern · Optional"><textarea value={builder.goalNotes} onChange={(e) => update("goalNotes", e.target.value)} rows={5} maxLength={360} placeholder="What would you like the vehicle to do, feel like or stop doing?" /></BuilderField>
            <BuilderField label="Current setup · Optional"><textarea value={builder.currentSetup} onChange={(e) => update("currentSetup", e.target.value)} rows={5} maxLength={360} placeholder="Current modifications, fitted parts or parts you already own." /></BuilderField>
          </div>
        </BuilderStep>

        <div className="plan-builder-action">
          <div><p className="eyebrow">Review &amp; Continue</p><h3>Open your PSI project brief.</h3><p>This creates an email draft addressed to PSI. Review it, then press Send in your email app. It is an enquiry, not a quote or booking.</p></div>
          <button className="button button-primary" type="submit">Open email enquiry <span aria-hidden="true">→</span></button>
        </div>
        {error && <p className="plan-builder-error" role="alert">{error}</p>}
      </form>
    </section>
  );
}

function BuilderStep({ number, title, copy, children }: { number: string; title: string; copy: string; children: ReactNode }) {
  return <section className="plan-builder-step"><div className="plan-builder-step-heading"><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></div>{children}</section>;
}

function BuilderField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="plan-builder-field"><span>{label}</span>{children}</label>;
}

function BuilderSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly PlanBuilderOption[]; onChange: (value: string) => void }) {
  return <BuilderField label={label}><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Choose an option</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></BuilderField>;
}
