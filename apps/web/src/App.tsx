import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AdminRoute } from './components/AdminRoute';
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute';
import { AdminClientMealPlansPage } from './pages/AdminClientMealPlansPage';
import { AdminClientTargetsPage } from './pages/AdminClientTargetsPage';
import { AdminClientWorkoutsPage } from './pages/AdminClientWorkoutsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CalendarPage } from './pages/CalendarPage';
import { DayDetailPage } from './pages/DayDetailPage';
import { ExerciseCreatePage } from './pages/ExerciseCreatePage';
import { ExerciseEditPage } from './pages/ExerciseEditPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { FoodCreatePage } from './pages/FoodCreatePage';
import { FoodEditPage } from './pages/FoodEditPage';
import { FoodSearchPage } from './pages/FoodSearchPage';
import { FoodsPage } from './pages/FoodsPage';
import { LoginPage } from './pages/LoginPage';
import { LogFoodPage } from './pages/LogFoodPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';
import { WeeklyMealPlansPage } from './pages/WeeklyMealPlansPage';
import { WeeklyTargetsPage } from './pages/WeeklyTargetsPage';
import { WorkoutsPage } from './pages/WorkoutsPage';

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
            <Route path="/day/:date" element={<DayDetailPage />} />
            <Route path="/foods" element={<FoodsPage />} />
            <Route path="/workouts" element={<WorkoutsPage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/weekly-targets" element={<WeeklyTargetsPage />} />
            <Route path="/weekly-meal-plans" element={<WeeklyMealPlansPage />} />
          </Route>
          <Route path="/foods/log" element={<LogFoodPage />} />
          <Route path="/foods/search" element={<FoodSearchPage />} />
          <Route path="/foods/new" element={<FoodCreatePage />} />
          <Route path="/foods/:foodId/edit" element={<FoodEditPage />} />
          <Route path="/exercises/new" element={<ExerciseCreatePage />} />
          <Route path="/exercises/:exerciseId/edit" element={<ExerciseEditPage />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/clients/:userId/targets" element={<AdminClientTargetsPage />} />
          <Route path="/admin/clients/:userId/meal-plans" element={<AdminClientMealPlansPage />} />
          <Route path="/admin/clients/:userId/workouts" element={<AdminClientWorkoutsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
