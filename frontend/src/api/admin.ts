import api from './api';
import type { AdminLogin, ApiResponse } from '../types';

// Admin authentication
export const loginAdmin = async (data: AdminLogin): Promise<ApiResponse> => {
    const response = await api.post('/api/admin/login', data);
    return response.data;
};

// Doctor management
export const addDoctor = async (formData: FormData): Promise<ApiResponse> => {
    const response = await api.post('/api/admin/add-doctor', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const getAllDoctorsAdmin = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/admin/all-doctors');
    return response.data;
};

export const changeDoctorAvailabilityAdmin = async (docId: string): Promise<ApiResponse> => {
    const response = await api.post('/api/admin/change-availability', { docId });
    return response.data;
};

// Appointments
export const getAllAppointmentsAdmin = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/admin/appointments');
    return response.data;
};

export const cancelAppointmentAdmin = async (appointmentId: string): Promise<ApiResponse> => {
    const response = await api.post('/api/admin/cancel-appointment', { appointmentId });
    return response.data;
};

// Dashboard
export const getAdminDashboard = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/admin/dashboard');
    return response.data;
};

// Dashboard Analytics (New)
export const getPlatformStats = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/admin/dashboard/stats');
    return response.data;
};

export const getDoctorPerformance = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/admin/dashboard/doctor-performance');
    return response.data;
};

export const getAppointmentAnalytics = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/admin/dashboard/appointment-analytics');
    return response.data;
};

export const getRecentActivity = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/admin/dashboard/activity');
    return response.data;
};

export const getRegistrationStats = async (period: 'today' | 'week' | 'month' = 'month'): Promise<ApiResponse> => {
    const response = await api.get(`/api/admin/dashboard/registrations?period=${period}`);
    return response.data;
};

// Patient Management
export const getAllPatientsAdmin = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/admin/all-patients');
    return response.data;
};

export const deletePatientAdmin = async (patientId: string): Promise<ApiResponse> => {
    const response = await api.post('/api/admin/delete-patient', { patientId });
    return response.data;
};

export const deleteDoctorAdmin = async (docId: string): Promise<ApiResponse> => {
    const response = await api.post('/api/admin/delete-doctor', { docId });
    return response.data;
};
