import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '../components/PageHeader';
import { api } from '../lib/client';
import type { AdminUser, Invitation } from '@calorie-tracker/shared';

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [lastInviteUrl, setLastInviteUrl] = useState('');

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.listUsers() as Promise<AdminUser[]>,
  });

  const invitationsQuery = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: () => api.listInvitations() as Promise<Invitation[]>,
  });

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setCreating(true);
    setMessage('');
    try {
      const result = await api.createInvitation(inviteEmail);
      setLastInviteUrl(result.inviteUrl);
      setInviteEmail('');
      await queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      setMessage('Invitation created. Copy the link below.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create invitation');
    } finally {
      setCreating(false);
    }
  };

  const copyInviteUrl = async () => {
    if (!lastInviteUrl) return;
    await navigator.clipboard.writeText(lastInviteUrl);
    setMessage('Invite link copied to clipboard');
  };

  return (
    <div>
      <PageHeader title="Admin" backTo="/settings" />
      <div className="mx-auto w-full min-w-0 max-w-lg space-y-4 px-4 pb-8">
        {message && <p className="text-sm text-primary">{message}</p>}

        <Card>
          <CardHeader>
            <CardTitle>Invite client</CardTitle>
            <CardDescription>Create a registration link to share with a new client</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createInvite} className="space-y-3">
              <Input
                type="email"
                placeholder="Client email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? 'Creating…' : 'Create invitation'}
              </Button>
            </form>
            {lastInviteUrl && (
              <div className="mt-4 space-y-2">
                <p className="break-all text-xs text-muted-foreground">{lastInviteUrl}</p>
                <Button type="button" variant="secondary" className="w-full" onClick={copyInviteUrl}>
                  Copy invite link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clients</CardTitle>
            <CardDescription>Manage weekly targets and meal plans for each client</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {usersQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {(usersQuery.data ?? []).map((client) => (
              <div
                key={client.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="font-medium">{client.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(client.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/clients/${client.id}/targets`}>Targets</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/clients/${client.id}/meal-plans`}>Meal plans</Link>
                  </Button>
                </div>
              </div>
            ))}
            {usersQuery.data?.length === 0 && !usersQuery.isLoading && (
              <p className="text-sm text-muted-foreground">No clients yet. Send an invite to get started.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitationsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {(invitationsQuery.data ?? []).map((invite) => (
              <div key={invite.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="font-medium">{invite.email}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.usedAt
                    ? `Used ${new Date(invite.usedAt).toLocaleDateString()}`
                    : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
