import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function SettingsPage() {
  const { logout, sync } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');

  const handleSync = async () => {
    setMessage('');
    try {
      await sync();
      setMessage('Your data has been synced with the server.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sync failed');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="mx-auto max-w-lg space-y-3 p-4">
      {message && <p className="text-sm text-primary">{message}</p>}

      <Link to="/weekly-meal-plans" className="card block border border-border-light">
        <p className="font-semibold">Weekly meal plan templates</p>
        <p className="mt-1 text-sm text-muted">Set default foods and portions for each day</p>
      </Link>

      <Link to="/weekly-targets" className="card block border border-border-light">
        <p className="font-semibold">Weekly macro defaults</p>
        <p className="mt-1 text-sm text-muted">Set default targets for each day of the week</p>
      </Link>

      <button
        type="button"
        onClick={handleSync}
        className="card w-full border border-border-light text-left"
      >
        <p className="font-semibold">Sync now</p>
        <p className="mt-1 text-sm text-muted">Push local changes and pull updates</p>
      </button>

      <button
        type="button"
        onClick={handleLogout}
        className="card w-full border border-danger-border text-left"
      >
        <p className="font-semibold text-danger">Sign out</p>
      </button>
    </div>
  );
}
