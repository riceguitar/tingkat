"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import type { Account } from "@/types/database";

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
}

interface AccountWithRole {
  account: Account;
  role: string;
}

export default function TeamPage() {
  const [accountsWithRole, setAccountsWithRole] = useState<AccountWithRole[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<"owner" | "member">("member");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

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
    // Get current user ID from Supabase session via a lightweight endpoint
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.id) setCurrentUserId(d.id);
    });
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    fetch(`/api/accounts/${selectedAccountId}/members`)
      .then((r) => r.json())
      .then(setMembers);

    const entry = accountsWithRole.find((a) => a.account.id === selectedAccountId);
    if (entry) setRole(entry.role as "owner" | "member");
  }, [selectedAccountId, accountsWithRole]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");
    const res = await fetch(`/api/accounts/${selectedAccountId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteError(data.error ?? "Failed to add member");
    } else {
      setMembers((prev) => [...prev, data]);
      setInviteSuccess(`Added ${inviteEmail} as a member.`);
      setInviteEmail("");
    }
    setInviting(false);
  }

  async function handleRemove(userId: string) {
    const res = await fetch(`/api/accounts/${selectedAccountId}/members/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    }
  }

  const selectedAccountName = accountsWithRole.find((a) => a.account.id === selectedAccountId)?.account.name;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Team" description="Manage who has access to each account" />

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
              {members.length} member{members.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground">{m.user_id.slice(0, 8)}…</span>
                  <Badge variant={m.role === "owner" ? "default" : "secondary"}>{m.role}</Badge>
                </div>
                {role === "owner" && m.user_id !== currentUserId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(m.user_id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}

            {role === "owner" && (
              <form onSubmit={handleInvite} className="pt-3 border-t space-y-2">
                <p className="text-sm font-medium">Add member</p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                  <Button type="submit" size="sm" disabled={inviting || !inviteEmail}>
                    {inviting ? "Adding..." : "Add"}
                  </Button>
                </div>
                {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
                {inviteSuccess && <p className="text-sm text-green-600">{inviteSuccess}</p>}
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
