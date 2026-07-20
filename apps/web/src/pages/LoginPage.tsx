import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inputFieldClass } from '@/lib/utils';
import { showError, showErrorFromUnknown } from '@/lib/toast';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trustedDevice, setTrustedDevice] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showError('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email, password, trustedDevice);
      navigate('/');
    } catch (err) {
      showErrorFromUnknown(err, 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8 pt-safe-top pb-safe">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Calorie Tracker</CardTitle>
          <CardDescription>Sign in to sync your data</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                className={inputFieldClass}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                className={inputFieldClass}
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={trustedDevice}
                onChange={(e) => setTrustedDevice(e.target.checked)}
              />
              <span>Trust this device — stay signed in longer on devices you own</span>
            </label>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t-0 pt-0">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link to="/register">Create an account</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
