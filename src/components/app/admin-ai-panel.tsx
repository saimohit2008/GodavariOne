"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Sparkles,
  Activity,
  DollarSign,
  Cpu,
  ShieldCheck,
  Send,
  AlertCircle,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from "lucide-react";

export function AdminAiPanel() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>({
    isEnabled: true,
    provider: "gemini",
    model: "gemini-1.5-flash",
    monthlyBudgetCap: 25.0,
    temperature: 0.3,
  });
  const [apiKeyMasked, setApiKeyMasked] = useState("••••••••••••••••");
  const [metrics, setMetrics] = useState<any>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    estimatedTotalTokens: 0,
    estimatedCostUsd: 0.0,
    monthlyBudgetUsd: 25.0,
  });

  const [adminQuery, setAdminQuery] = useState("");
  const [adminReply, setAdminReply] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);

  useEffect(() => {
    fetchConfigAndMetrics();
  }, []);

  async function fetchConfigAndMetrics() {
    setLoading(true);
    try {
      const [cfgRes, usageRes] = await Promise.all([
        fetch("/api/v1/admin/ai/config").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/v1/admin/ai/usage").then((r) => (r.ok ? r.json() : null)),
      ]);

      if (cfgRes?.config) {
        setConfig(cfgRes.config);
        setApiKeyMasked(cfgRes.apiKeyMasked || "Configured via Server Environment");
      }
      if (usageRes?.metrics) {
        setMetrics(usageRes.metrics);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load AI analytics.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig() {
    try {
      const res = await fetch("/api/v1/admin/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Update failed");
      toast({ title: "Success", description: "AI Configuration updated successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to update AI configuration.", variant: "destructive" });
    }
  }

  async function handleAdminQuery(prefilled?: string) {
    const q = (prefilled || adminQuery).trim();
    if (!q || querying) return;

    setQuerying(true);
    setAdminReply(null);

    try {
      const res = await fetch("/api/v1/admin/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Query failed");
      }

      const data = await res.json();
      setAdminReply(data.reply);
      setAdminQuery("");
    } catch (e: any) {
      toast({ title: "Query Error", description: e.message, variant: "destructive" });
    } finally {
      setQuerying(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card">
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-xl bg-teal-600 text-white grid place-items-center shadow-xs">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight">AI Assistant & Copilot Controls</h2>
            <p className="text-xs text-muted-foreground">
              Monitor operational token usage, cost estimation, provider settings, and run administrative analytics queries.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={
              config.isEnabled
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400"
            }
          >
            {config.isEnabled ? "SERVICE ACTIVE" : "SERVICE DISABLED"}
          </Badge>
          <Button size="sm" variant="outline" onClick={fetchConfigAndMetrics} disabled={loading}>
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Activity className="size-3.5 text-teal-600" /> Total Requests
          </p>
          <p className="text-2xl font-bold tracking-tight">{metrics.totalRequests || 0}</p>
          <p className="text-[11px] text-emerald-600 font-medium">
            {metrics.successfulRequests || 0} Successful (
            {metrics.totalRequests ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 100) : 100}%)
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Cpu className="size-3.5 text-sky-600" /> Tokens Consumed
          </p>
          <p className="text-2xl font-bold tracking-tight">
            {(metrics.estimatedTotalTokens || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">Prompt + Completion</p>
        </Card>

        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <DollarSign className="size-3.5 text-amber-600" /> Estimated Spend
          </p>
          <p className="text-2xl font-bold tracking-tight">
            ${(metrics.estimatedCostUsd || 0).toFixed(4)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Budget Cap: ${config.monthlyBudgetCap || 25}.00 / mo
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-indigo-600" /> Active Model
          </p>
          <p className="text-lg font-bold truncate">{config.model || "gemini-1.5-flash"}</p>
          <p className="text-[11px] text-muted-foreground capitalize">Provider: {config.provider || "Gemini"}</p>
        </Card>
      </div>

      {/* Admin AI Copilot Console */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-teal-600" /> Interactive Operational Copilot
          </CardTitle>
          <CardDescription>
            Ask operational questions grounded strictly in live database records. Read-only analytics with zero booking hallucination.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick prompt buttons */}
          <div className="flex flex-wrap gap-2">
            {[
              "Summarize today's booking status",
              "Check failed email notification outbox",
              "Which ghats are officially closed right now?",
              "Show pending hotel and restaurant workloads",
            ].map((prompt, i) => (
              <Button
                key={i}
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => handleAdminQuery(prompt)}
                disabled={querying}
              >
                {prompt}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={adminQuery}
              onChange={(e) => setAdminQuery(e.target.value)}
              placeholder="e.g. How many hotel bookings are currently pending review?"
              disabled={querying}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdminQuery();
              }}
            />
            <Button
              onClick={() => handleAdminQuery()}
              disabled={!adminQuery.trim() || querying}
              className="bg-teal-700 hover:bg-teal-800 text-white shrink-0"
            >
              <Send className="size-4 mr-1.5" /> Ask Copilot
            </Button>
          </div>

          {/* Reply Display */}
          {adminReply && (
            <div className="p-4 rounded-xl border bg-muted/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
                <CheckCircle2 className="size-4" /> Grounded Operational Summary:
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{adminReply}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration & Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="size-4 text-teal-600" /> Operational Parameters & Cost Controls
          </CardTitle>
          <CardDescription>
            Adjust server-side AI model selection, monthly threshold, and service emergency killswitch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div>
              <p className="font-medium text-sm">AI Service Master Switch</p>
              <p className="text-xs text-muted-foreground">
                Instantly enable or disable public AI assistant without restarting server
              </p>
            </div>
            <Switch
              checked={config.isEnabled}
              onCheckedChange={(val) => setConfig((c: any) => ({ ...c, isEnabled: val }))}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={config.provider}
                onValueChange={(val) => setConfig((c: any) => ({ ...c, provider: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini (Recommended - Multilingual)</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT-4o Mini)</SelectItem>
                  <SelectItem value="mock">Local Deterministic Engine (Offline / Tests)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Model Name</Label>
              <Input
                value={config.model}
                onChange={(e) => setConfig((c: any) => ({ ...c, model: e.target.value }))}
                placeholder="e.g. gemini-1.5-flash"
              />
            </div>

            <div className="space-y-2">
              <Label>Monthly Budget Cap (USD)</Label>
              <Input
                type="number"
                value={config.monthlyBudgetCap}
                onChange={(e) => setConfig((c: any) => ({ ...c, monthlyBudgetCap: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label>API Key Status (Server-Side Only)</Label>
              <Input value={apiKeyMasked} disabled className="bg-muted text-muted-foreground font-mono text-xs" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveConfig} className="bg-teal-700 hover:bg-teal-800 text-white">
              Save AI Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
