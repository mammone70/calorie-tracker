import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 8) {
      setError('Email required and password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 pt-safe-top pb-safe">
      <h1 className="mb-2 text-3xl font-bold">Create Account</h1>
      <p className="mb-8 text-muted">Set up your personal calorie tracker</p>

      <form onSubmit={handleRegister} className="space-y-2">
        <input
          className="input-field"
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input-field"
          placeholder="Password (min 8 characters)"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn-primary mt-2 w-full" disabled={loading}>
          {loading ? 'Creating…' : 'Create Account'}
        </button>
      </form>

      <Link to="/login" className="link mt-6 block text-center">
        Already have an account? Sign in
      </Link>
    </div>
  );
}
