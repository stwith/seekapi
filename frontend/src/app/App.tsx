import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Shell } from "@/components/layout/Shell.js";
import { PageTransition } from "@/components/layout/PageTransition.js";
import { Overview } from "@/routes/overview/Overview.js";
import { ProjectList } from "@/routes/projects/ProjectList.js";
import { ProjectDetailPage } from "@/routes/projects/ProjectDetail.js";
import { FlowRunner } from "@/routes/flow-runner/FlowRunner.js";
import { Dashboard } from "@/routes/dashboard/Dashboard.js";
import { KeysPage } from "@/routes/keys/KeysPage.js";
import { UsagePage } from "@/routes/usage/UsagePage.js";
import { ProvidersPage } from "@/routes/providers/ProvidersPage.js";
import { ErrorBoundary } from "@/components/ui/error-boundary.js";
import { Input } from "@/components/ui/shadcn/input";
import { Button } from "@/components/ui/shadcn/button";
import { FormField } from "@/components/ui/form-field.js";
import { Toaster } from "@/components/ui/shadcn/sonner";

export function App() {
  const [adminKey, setAdminKey] = useState(
    () => sessionStorage.getItem("seekapi_admin_key") ?? "",
  );

  function handleSetAdminKey(key: string) {
    setAdminKey(key);
    if (key) {
      sessionStorage.setItem("seekapi_admin_key", key);
    } else {
      sessionStorage.removeItem("seekapi_admin_key");
    }
  }

  if (!adminKey) {
    return (
      <>
        <LoginGate onSubmit={handleSetAdminKey} />
        <Toaster />
      </>
    );
  }

  return (
    <BrowserRouter>
      <Shell adminKey={adminKey} onLogout={() => handleSetAdminKey("")}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<PageTransition><Overview adminKey={adminKey} /></PageTransition>} />
            <Route path="/dashboard" element={<PageTransition><Dashboard adminKey={adminKey} /></PageTransition>} />
            <Route path="/projects" element={<PageTransition><ProjectList adminKey={adminKey} /></PageTransition>} />
            <Route path="/projects/:projectId" element={<PageTransition><ProjectDetailPage adminKey={adminKey} /></PageTransition>} />
            <Route path="/keys" element={<PageTransition><KeysPage adminKey={adminKey} /></PageTransition>} />
            <Route path="/usage" element={<PageTransition><UsagePage adminKey={adminKey} /></PageTransition>} />
            <Route path="/providers" element={<PageTransition><ProvidersPage adminKey={adminKey} /></PageTransition>} />
            <Route path="/flow-runner" element={<PageTransition><FlowRunner adminKey={adminKey} /></PageTransition>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </Shell>
      <Toaster />
    </BrowserRouter>
  );
}

function LoginGate({ onSubmit }: { onSubmit: (key: string) => void }) {
  const { t } = useTranslation();
  const [key, setKey] = useState("");
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="w-full max-w-sm px-6"
      >
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-semibold tracking-tighter text-foreground">
            {t("login.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) onSubmit(key.trim());
          }}
          className="space-y-4"
        >
          <FormField label={t("login.label")} htmlFor="admin-key">
            <Input
              id="admin-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t("login.placeholder")}
            />
          </FormField>
          <Button type="submit" className="w-full">
            {t("login.connect")}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
