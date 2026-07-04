import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute';
import { CalendarPage } from './pages/CalendarPage';
import { DayDetailPage } from './pages/DayDetailPage';
import { FoodCreatePage } from './pages/FoodCreatePage';
import { FoodSearchPage } from './pages/FoodSearchPage';
import { FoodsPage } from './pages/FoodsPage';
import { LoginPage } from './pages/LoginPage';
import { LogFoodPage } from './pages/LogFoodPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';
import { WeeklyMealPlansPage } from './pages/WeeklyMealPlansPage';
import { WeeklyTargetsPage } from './pages/WeeklyTargetsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<TodayPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/foods" element={<FoodsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/weekly-targets" element={<WeeklyTargetsPage />} />
            <Route path="/weekly-meal-plans" element={<WeeklyMealPlansPage />} />
          </Route>
          <Route path="/day/:date" element={<DayDetailPage />} />
          <Route path="/foods/log" element={<LogFoodPage />} />
          <Route path="/foods/search" element={<FoodSearchPage />} />
          <Route path="/foods/new" element={<FoodCreatePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
