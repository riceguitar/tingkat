"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProject } from "@/lib/context/project-context";
import type { Account } from "@/types/database";

interface CredentialStatus {
  key: string;
  isSet: boolean;
}

interface AccountWithRole {
  account: Account;
  role: string;
}

const CREDENTIAL_LABELS: Record<string, { label: string; placeholder: string }> = {
  dataforseo_login: { label: "DataForSEO Login (email)", placeholder: "your@email.com" },
  dataforseo_api_key: { label: "DataForSEO API Key", placeholder: "••••••••" },
  anthropic_api_key: { label: "Anthropic API Key", placeholder: "sk-ant-..." },
};

export default function CredentialsPage() {
  const { accounts } = useProject();
  const [accountsWithRole, setAccountsWithRole] = useState<AccountWithRole[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: AccountWithRole[]) => {
        setAccountsWithRole(data);
        if (data.length > 0) {
          setSelectedAccountId(data[0].account.id);
          setRole(data[0].role as "owner" | "member");
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    fetch(`/api/accounts/${selectedAccountId}/credentials`)
      .then((r) => r.json())
      .then(setCredentials);

    const entry = accountsWithRole.find((a) => a.account.id === selectedAccountId);
    if (entry) setRole(entry.role as "owner" | "member");
  }, [selectedAccountId, accountsWithRole]);

  async function handleSave(key: string) {
    setSaving(true);
    setSaveError("");
    const res = await fetch(`/api/accounts/${selectedAccountId}/credentials`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: inputValue }),
    });
    if (!res.ok) {
      const data = await res.json();
      setSaveError(data.error ?? "Failed to save");
    } else {
      setCredentials((prev) => prev.map((c) => c.key === key ? { ...c, isSet: true } : c));
      setEditingKey(null);
      setInputValue("");
    }
    setSaving(false);
  }

  const selectedAccountName = accountsWithRole.find((a) => a.account.id === selectedAccountId)?.account.name;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="API Credentials" description="Store per-account API keys for DataForSEO and Anthropic" />

      {accountsWithRole.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {accountsWithRole.map(({ account }) => (
            <Button
              key={account.id}
              variant={selectedAccountId === account.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedAccountId(account.id)}
            >
              {account.name}
            </Button>
          ))}
        </div>
      )}

      {selectedAccountId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selectedAccountName}</CardTitle>
            <CardDescription>
              {role === "owner"
                ? "As an owner, you can set and change credentials."
                : "You have read access to this account. Only owners can change credentials."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {credentials.map(({ key, isSet }) => {
              const meta = CREDENTIAL_LABELS[key] ?? { label: key, placeholder: "" };
              const isEditing = editingKey === key;

              return (
                <div key={key} className="space-y-1.5">
                  <Label>{meta.label}</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={meta.placeholder}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        disabled={saving || !inputValue}
                        onClick={() => handleSave(key)}
                      >
                        {saving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditingKey(null); setInputValue(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={isSet ? "••••••••••••••••" : "Not set"}
                        className="text-muted-foreground"
                      />
                      {role === "owner" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditingKey(key); setInputValue(""); setSaveError(""); }}
                        >
                          {isSet ? "Change" : "Set"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
