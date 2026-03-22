import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
import { Input } from "@/components/ui/shadcn/input";
import { Button } from "@/components/ui/shadcn/button";
import { FormField } from "@/components/ui/form-field.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/shadcn/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { CheckCircle2, XCircle } from "lucide-react";

interface FlowRunnerProps {
  adminKey: string;
}

interface StepResult {
  status: "pending" | "running" | "success" | "failure";
  detail?: string;
  timestamp?: string;
}

const STEP_COUNT = 10;

export function FlowRunner({ adminKey }: FlowRunnerProps) {
  const { t } = useTranslation();

  const getStepLabels = () => [
    t("flowRunner.step1"),
    t("flowRunner.step2"),
    t("flowRunner.step3"),
    t("flowRunner.step4"),
    t("flowRunner.step5"),
    t("flowRunner.step6"),
    t("flowRunner.step7"),
    t("flowRunner.step8"),
    t("flowRunner.step9"),
    t("flowRunner.step10"),
  ];

  const [steps, setSteps] = useState<StepResult[]>(
    Array.from({ length: STEP_COUNT }, () => ({ status: "pending" as const })),
  );
  const [running, setRunning] = useState(false);
  const [braveSecret, setBraveSecret] = useState("");
  const braveSecretRef = useRef("");
  const [searchQuery, setSearchQuery] = useState("seekapi test");
  const searchQueryRef = useRef("seekapi test");

  const updateStep = useCallback(
    (idx: number, result: StepResult) =>
      setSteps((prev) => prev.map((s, i) => (i === idx ? result : s))),
    [],
  );

  async function runFlow() {
    if (!braveSecretRef.current.trim()) return;
    setRunning(true);
    setSteps(Array.from({ length: STEP_COUNT }, () => ({ status: "pending" as const })));

    let projectId = "";
    let keyA = "";
    let keyB = "";
    let keyBId = "";
    let currentStep = 0;

    try {
      currentStep = 0;
      updateStep(0, { status: "running" });
      const project = await api.createProject(adminKey, `flow-test-${Date.now()}`);
      projectId = project.id;
      updateStep(0, { status: "success", detail: `Project: ${project.id}`, timestamp: new Date().toISOString() });

      currentStep = 1;
      updateStep(1, { status: "running" });
      await api.upsertCredential(adminKey, projectId, "brave", braveSecretRef.current.trim());
      updateStep(1, { status: "success", detail: "Brave credential attached", timestamp: new Date().toISOString() });

      currentStep = 2;
      updateStep(2, { status: "running" });
      await api.configureBinding(adminKey, projectId, { provider: "brave", capability: "search.web", enabled: true, priority: 0 });
      updateStep(2, { status: "success", detail: "search.web enabled", timestamp: new Date().toISOString() });

      currentStep = 3;
      updateStep(3, { status: "running" });
      const keyAResult = await api.createApiKey(adminKey, projectId);
      keyA = keyAResult.rawKey;
      updateStep(3, { status: "success", detail: `Key A: ${keyA.slice(0, 12)}...`, timestamp: new Date().toISOString() });

      currentStep = 4;
      updateStep(4, { status: "running" });
      const keyBResult = await api.createApiKey(adminKey, projectId);
      keyB = keyBResult.rawKey;
      keyBId = keyBResult.id;
      updateStep(4, { status: "success", detail: `Key B: ${keyB.slice(0, 12)}...`, timestamp: new Date().toISOString() });

      currentStep = 5;
      updateStep(5, { status: "running" });
      const searchA = await api.search(keyA, searchQueryRef.current);
      if (searchA.status === 200) {
        updateStep(5, { status: "success", detail: `HTTP ${searchA.status}`, timestamp: new Date().toISOString() });
      } else {
        updateStep(5, { status: "failure", detail: `HTTP ${searchA.status}`, timestamp: new Date().toISOString() });
        setRunning(false);
        return;
      }

      currentStep = 6;
      updateStep(6, { status: "running" });
      const searchB = await api.search(keyB, searchQueryRef.current);
      if (searchB.status === 200) {
        updateStep(6, { status: "success", detail: `HTTP ${searchB.status}`, timestamp: new Date().toISOString() });
      } else {
        updateStep(6, { status: "failure", detail: `HTTP ${searchB.status}`, timestamp: new Date().toISOString() });
        setRunning(false);
        return;
      }

      currentStep = 7;
      updateStep(7, { status: "running" });
      await api.disableApiKey(adminKey, keyBId);
      updateStep(7, { status: "success", detail: "Key B disabled", timestamp: new Date().toISOString() });

      currentStep = 8;
      updateStep(8, { status: "running" });
      const verifyB = await api.search(keyB, searchQueryRef.current);
      if (verifyB.status === 401) {
        updateStep(8, { status: "success", detail: `HTTP ${verifyB.status} (expected)`, timestamp: new Date().toISOString() });
      } else {
        updateStep(8, { status: "failure", detail: `HTTP ${verifyB.status} (expected 401)`, timestamp: new Date().toISOString() });
        setRunning(false);
        return;
      }

      currentStep = 9;
      updateStep(9, { status: "running" });
      const verifyA = await api.search(keyA, searchQueryRef.current);
      if (verifyA.status === 200) {
        updateStep(9, { status: "success", detail: `HTTP ${verifyA.status}`, timestamp: new Date().toISOString() });
      } else {
        updateStep(9, { status: "failure", detail: `HTTP ${verifyA.status} (expected 200)`, timestamp: new Date().toISOString() });
      }
    } catch (err: unknown) {
      updateStep(currentStep, {
        status: "failure",
        detail: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setRunning(false);
    }
  }

  const allDone = steps.every((s) => s.status === "success");
  const hasFailed = steps.some((s) => s.status === "failure");
  const stepLabels = getStepLabels();

  return (
    <div>
      <PageHeader title={t("flowRunner.title")} subtitle={t("flowRunner.subtitle")} />

      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <FormField label={t("flowRunner.braveApiSecret")} htmlFor="brave-secret">
          <Input
            id="brave-secret"
            type="password"
            value={braveSecret}
            onChange={(e) => { setBraveSecret(e.target.value); braveSecretRef.current = e.target.value; }}
            placeholder={t("flowRunner.braveApiSecret")}
            className="w-64"
          />
        </FormField>
        <FormField label={t("flowRunner.searchQuery")} htmlFor="search-query">
          <Input
            id="search-query"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); searchQueryRef.current = e.target.value; }}
            placeholder={t("flowRunner.searchQueryPlaceholder")}
            className="w-52"
          />
        </FormField>
        <div className="flex flex-col">
          <span className="h-4 mb-1.5 block" />
          <Button onClick={runFlow} disabled={running} className="h-9">
            {running ? t("flowRunner.running") : t("flowRunner.runFlow")}
          </Button>
        </div>
      </div>

      {allDone && (
        <Alert data-testid="flow-success" className="mb-4 border-emerald-600/50 text-emerald-400">
          <CheckCircle2 className="size-4 text-emerald-500" />
          <AlertTitle>{t("flowRunner.successTitle")}</AlertTitle>
          <AlertDescription>{t("flowRunner.successMessage")}</AlertDescription>
        </Alert>
      )}
      {hasFailed && (
        <Alert data-testid="flow-failure" variant="destructive" className="mb-4">
          <XCircle className="size-4" />
          <AlertTitle>{t("flowRunner.failedTitle")}</AlertTitle>
          <AlertDescription>{t("flowRunner.failedMessage")}</AlertDescription>
        </Alert>
      )}

      <Table data-testid="flow-steps">
        <TableHeader>
          <TableRow>
            <TableHead>{t("flowRunner.step")}</TableHead>
            <TableHead className="w-28">{t("common.status")}</TableHead>
            <TableHead>{t("flowRunner.detail")}</TableHead>
            <TableHead className="w-44">{t("flowRunner.time")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {steps.map((step, i) => (
            <TableRow key={i} className="transition-colors hover:bg-muted/50">
              <TableCell className="text-sm">{stepLabels[i]}</TableCell>
              <TableCell>
                <StatusBadge
                  variant={
                    step.status === "success" ? "active" :
                    step.status === "failure" ? "error" :
                    step.status === "running" ? "pending" : "disabled"
                  }
                  label={step.status}
                />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {step.detail ?? "\u2014"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {step.timestamp ?? "\u2014"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
