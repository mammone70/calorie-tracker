import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../lib/client';
import { useAuth } from '../contexts/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') ?? undefined;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (!inviteToken) {
      setInviteLoading(false);
      return;
    }

    api
      .previewInvite(inviteToken)
      .then((preview) => {
        setEmail(preview.email);
        setInviteError('');
      })
      .catch((err) => {
        setInviteError(err instanceof Error ? err.message : 'Invalid invitation link');
      })
      .finally(() => setInviteLoading(false));
  }, [inviteToken]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 8) {
      setError('Email required and password must be at least 8 characters');
      return;
    }
    if (!inviteToken) {
      setError('Registration requires a valid invitation link');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(email, password, inviteToken);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (inviteLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-muted-foreground">
        Loading invitation…
      </div>
    );
  }

  if (!inviteToken) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-6 pt-safe-top pb-safe">
        <h1 className="mb-2 text-3xl font-bold">Registration closed</h1>
        <p className="mb-8 text-muted-foreground">
          New accounts require an invitation link from your coach or administrator.
        </p>
        <Button variant="link" className="w-full" asChild>
          <Link to="/login">Already have an account? Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 pt-safe-top pb-safe">
      <h1 className="mb-2 text-3xl font-bold">Create Account</h1>
      <p className="mb-8 text-muted-foreground">Complete your registration using your invitation</p>

      {inviteError && <p className="mb-4 text-sm text-destructive">{inviteError}</p>}

      <form onSubmit={handleRegister} className="space-y-3">
        <Input
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          readOnly={!!email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="Password (min 8 characters)"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="mt-2 w-full"
          size="lg"
          disabled={loading || !!inviteError}
        >
          {loading ? 'Creating…' : 'Create Account'}
        </Button>
      </form>

      <Button variant="link" className="mt-6 w-full" asChild>
        <Link to="/login">Already have an account? Sign in</Link>
      </Button>
    </div>
  );
}
