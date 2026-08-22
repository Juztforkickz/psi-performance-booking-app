import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

async function loadPlanBuildPreview() {
  const source = await read("../mobile/src/lib/plan-build-preview.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("keeps the Plan & Build brief local, explicit and fail-closed", async () => {
  const [screen, preview, publicDemo] = await Promise.all([
    read("../mobile/src/app/parts.tsx"),
    read("../mobile/src/lib/plan-build-preview.ts"),
    read("../mobile/src/lib/public-demo.ts"),
  ]);

  for (const category of [
    "Engine",
    "Suspension",
    "Exhaust",
    "Intake",
    "Repairs",
    "Interior",
    "Programming",
    "Other",
  ]) {
    assert.match(preview, new RegExp(`label: '${category}'`, "u"));
  }

  assert.match(screen, /useState<PlanBuildDraft>/);
  assert.match(screen, /Nothing has been sent/);
  assert.match(screen, /Open SMS draft/);
  assert.match(screen, /Open email draft/);
  assert.match(screen, /Open Instagram to DM/);
  assert.match(screen, /Open Facebook to message/);
  assert.match(screen, /disabled=\{!canOpenHandoff\}/);
  assert.match(screen, /selectable style=\{styles\.briefPreview\}/);
  assert.match(screen, /https:\/\/ig\.me\/m\/psiperformancegarage/);
  assert.match(screen, /https:\/\/m\.me\/psiperformancegarage/);
  assert.match(screen, /becomes a real message to PSI/);

  for (const forbidden of ["AsyncStorage", "fetch(", "EXPO_PUBLIC_API_BASE_URL", "router.push({"]) {
    assert.doesNotMatch(screen, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }

  assert.match(preview, /sms:\+61433431781/);
  assert.match(preview, /mailto:info@psiperformance\.com\.au/);
  assert.match(preview, /encodeURIComponent\(subject\)/);
  assert.match(preview, /encodeURIComponent\(body\)/);
  assert.match(preview, /Brief shortened for this message/);

  for (const flag of [
    "submissionsDisabled",
    "customerAccountsDisabled",
    "persistentVehicleRecordsDisabled",
    "photoUploadsDisabled",
    "pushNotificationsDisabled",
    "customerDynoEditsDisabled",
  ]) {
    assert.match(publicDemo, new RegExp(`${flag}: true`, "u"));
  }
});

test("gives Plan & Build dropdowns accessible explicit selection states", async () => {
  const select = await read("../mobile/src/components/plan-build-select.tsx");

  assert.match(select, /accessibilityState=\{\{ expanded: open \}\}/);
  assert.match(select, /accessibilityViewIsModal/);
  assert.match(select, /accessibilityRole="radiogroup"/);
  assert.match(select, /accessibilityRole="radio"/);
  assert.match(select, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(select, /onRequestClose=\{\(\) => setOpen\(false\)\}/);
});

test("omits hidden dependent text and validates the visible Plan & Build choices", async () => {
  const {
    createEmptyPlanBuildDraft,
    formatPlanBuildBrief,
    getPlanBuildDraftIssue,
  } = await loadPlanBuildPreview();
  const draft = createEmptyPlanBuildDraft();

  assert.equal(getPlanBuildDraftIssue(draft), "Choose at least one build area.");
  draft.selectedAreas = ["engine"];
  assert.equal(getPlanBuildDraftIssue(draft), "Choose what you would like to discuss for Engine.");

  draft.areaSelections.engine = "not-a-real-option";
  assert.equal(getPlanBuildDraftIssue(draft), "Choose what you would like to discuss for Engine.");

  draft.areaSelections.engine = "other";
  assert.equal(getPlanBuildDraftIssue(draft), "Add the other details for Engine.");
  draft.areaNotes.engine = "Visible custom engine concern";
  assert.equal(getPlanBuildDraftIssue(draft), null);
  assert.match(formatPlanBuildBrief(draft, "Demo vehicle"), /Visible custom engine concern/u);

  draft.areaSelections.engine = "health";
  assert.doesNotMatch(formatPlanBuildBrief(draft, "Demo vehicle"), /Visible custom engine concern/u);

  draft.budget = "defined";
  draft.budgetDetails = "A private budget note";
  assert.match(formatPlanBuildBrief(draft, "Demo vehicle"), /A private budget note/u);
  draft.budget = "guidance";
  assert.doesNotMatch(formatPlanBuildBrief(draft, "Demo vehicle"), /A private budget note/u);
  assert.doesNotMatch(formatPlanBuildBrief(draft, "Demo vehicle"), /Not chosen/u);
});

test("encodes contact drafts safely across special characters and emoji boundaries", async () => {
  const {
    buildPlanEmailUrl,
    buildPlanSmsUrl,
    limitPlanBriefForContact,
    resolvePlanSmsPlatform,
  } = await loadPlanBuildPreview();
  const hostile = "Engine & exhaust? #1 at 50% + tune 🚗\nSecond line";

  const emailUrl = buildPlanEmailUrl(hostile);
  assert.match(emailUrl, /^mailto:info@psiperformance\.com\.au\?subject=/u);
  assert.equal(decodeURIComponent(emailUrl.split("&body=")[1]), hostile);

  const boundary = `${"x".repeat(1399)}🚗tail`;
  const smsUrl = buildPlanSmsUrl(boundary, "ios");
  const smsBody = decodeURIComponent(smsUrl.split("body=")[1]);
  assert.ok(Array.from(smsBody).length <= 1400);
  assert.match(smsBody, /\[Brief shortened for this message\]$/u);
  assert.doesNotMatch(smsBody, /[\uD800-\uDFFF]/u);

  assert.doesNotThrow(() => buildPlanSmsUrl(`${"x".repeat(1399)}\uD83D`, "android"));
  assert.equal(limitPlanBriefForContact("🚗".repeat(10), 8), "\n\n[Brief".slice(0, 8));
  assert.equal(resolvePlanSmsPlatform("web", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
  assert.equal(resolvePlanSmsPlatform("web", "Mozilla/5.0 (Linux; Android 15)"), "web");
  assert.equal(resolvePlanSmsPlatform("android", ""), "android");
});
