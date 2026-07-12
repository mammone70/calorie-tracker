import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '../contexts/AuthContext';
import { COLOR_THEME_OPTIONS, useTheme, type ColorTheme } from '../contexts/ThemeContext';

export function SettingsPage() {
  const { logout, sync, isAdmin, changePassword, user, updatePreferences } = useAuth();
  const { colorTheme, setColorTheme } = useTheme();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingWeightUnit, setSavingWeightUnit] = useState(false);

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

  const handleWeightUnitChange = async (value: string) => {
    if (value !== 'lbs' && value !== 'kg') return;
    setSavingWeightUnit(true);
    setMessage('');
    try {
      await updatePreferences({ weightUnit: value });
      setMessage(`Weight unit set to ${value}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update weight unit');
    } finally {
      setSavingWeightUnit(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setMessage('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    setMessage('');
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/login');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg space-y-3 p-4">
      {message && <p className="text-sm text-primary">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose a color theme for the app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="color-theme">Color theme</Label>
          <Select
            value={colorTheme}
            onValueChange={(value) => setColorTheme(value as ColorTheme)}
          >
            <SelectTrigger id="color-theme" className="w-full">
              <SelectValue placeholder="Select a theme" />
            </SelectTrigger>
            <SelectContent>
              {COLOR_THEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Units</CardTitle>
          <CardDescription>Weight unit for lifting templates and logging</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="weight-unit">Weight</Label>
          <Select
            value={user?.weightUnit ?? 'lbs'}
            onValueChange={(value) => void handleWeightUnitChange(value)}
            disabled={savingWeightUnit}
          >
            <SelectTrigger id="weight-unit" className="w-full">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lbs">lbs</SelectItem>
              <SelectItem value="kg">kg</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <Input
              type="password"
              placeholder="Current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="New password (min 8 characters)"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={changingPassword}>
              {changingPassword ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isAdmin && (
        <Link to="/admin" className="block">
          <Card>
            <CardHeader>
              <CardTitle>Admin dashboard</CardTitle>
              <CardDescription>Manage clients, invites, macros, and meal plans</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      )}

      <Link to="/weekly-meal-plans" className="block">
        <Card>
          <CardHeader>
            <CardTitle>Weekly meal plan templates</CardTitle>
            <CardDescription>Set default foods and portions for each day</CardDescription>
          </CardHeader>
        </Card>
      </Link>

      <Link to="/weekly-targets" className="block">
        <Card>
          <CardHeader>
            <CardTitle>Weekly macro defaults</CardTitle>
            <CardDescription>Set default targets for each day of the week</CardDescription>
          </CardHeader>
        </Card>
      </Link>

      <button type="button" onClick={handleSync} className="w-full text-left">
        <Card>
          <CardHeader>
            <CardTitle>Sync now</CardTitle>
            <CardDescription>Push local changes and pull updates</CardDescription>
          </CardHeader>
        </Card>
      </button>

      <Button variant="destructive" className="w-full justify-start" onClick={handleLogout}>
        Sign out
      </Button>
    </div>
  );
}
