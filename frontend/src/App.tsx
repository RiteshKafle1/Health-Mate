import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/user/Register';

// User Pages
import { UserDashboard } from './pages/user/Dashboard';
import { UserProfile } from './pages/user/Profile';
import { Doctors } from './pages/user/Doctors';
import { BookAppointment } from './pages/user/BookAppointment';
import { UserAppointments } from './pages/user/Appointments';
import { Chatbot } from './pages/user/Chatbot';
import { Medications } from './pages/user/Medications';

// Doctor Pages
import { DoctorDashboard } from './pages/doctor/Dashboard';
import { DoctorProfile } from './pages/doctor/Profile';
import { DoctorAppointments } from './pages/doctor/Appointments';
import { Chatbot as DoctorChatbot } from './pages/doctor/Chatbot';

// Admin Pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { AddDoctor } from './pages/admin/AddDoctor';
import { AllDoctors } from './pages/admin/AllDoctors';
import { AdminAppointments } from './pages/admin/Appointments';
import { Chatbot as AdminChatbot } from './pages/admin/Chatbot';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/doctors" element={<Doctors />} />

            {/* User Routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['user']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/user/dashboard" element={<UserDashboard />} />
              <Route path="/user/profile" element={<UserProfile />} />
              <Route path="/user/doctors" element={<Doctors />} />
              <Route path="/user/book/:doctorId" element={<BookAppointment />} />
              <Route path="/user/appointments" element={<UserAppointments />} />
              <Route path="/user/medications" element={<Medications />} />
              <Route path="/user/chatbot" element={<Chatbot />} />
            </Route>

            {/* Doctor Routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
              <Route path="/doctor/profile" element={<DoctorProfile />} />
              <Route path="/doctor/appointments" element={<DoctorAppointments />} />
              <Route path="/doctor/chatbot" element={<DoctorChatbot />} />
            </Route>

            {/* Admin Routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/add-doctor" element={<AddDoctor />} />
              <Route path="/admin/doctors" element={<AllDoctors />} />
              <Route path="/admin/appointments" element={<AdminAppointments />} />
              <Route path="/admin/chatbot" element={<AdminChatbot />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>

          {/* Toast Notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '12px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#f8fafc',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#f8fafc',
                },
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
