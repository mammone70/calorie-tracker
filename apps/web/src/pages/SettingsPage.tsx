import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const { logout, sync } = useAuth();
  const { colorTheme, setColorTheme } = useTheme();
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
