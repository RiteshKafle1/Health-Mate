import api from './api';
import type { DoctorLogin, DoctorUpdate, ApiResponse } from '../types';

// Doctor authentication
export const loginDoctor = async (data: DoctorLogin): Promise<ApiResponse> => {
    const response = await api.post('/api/doctor/login', data);
    return response.data;
};

// Public - list all doctors
export const getAllDoctors = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/doctor/list');
    return response.data;
};

// Doctor profile
export const getDoctorProfile = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/doctor/profile');
    return response.data;
};

export const updateDoctorProfile = async (data: DoctorUpdate): Promise<ApiResponse> => {
    const response = await api.post('/api/doctor/update-profile', data);
    return response.data;
};

// Doctor appointments
export const getDoctorAppointments = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/doctor/appointments');
    return response.data;
};

export const cancelDoctorAppointment = async (appointmentId: string): Promise<ApiResponse> => {
    const response = await api.post('/api/doctor/cancel-appointment', { appointmentId });
    return response.data;
};

export const completeDoctorAppointment = async (appointmentId: string): Promise<ApiResponse> => {
    const response = await api.post('/api/doctor/complete-appointment', { appointmentId });
    return response.data;
};

// Doctor availability
export const changeDoctorAvailability = async (): Promise<ApiResponse> => {
    const response = await api.post('/api/doctor/change-availability');
    return response.data;
};

// Doctor dashboard
export const getDoctorDashboard = async (): Promise<ApiResponse> => {
    const response = await api.get('/api/doctor/dashboard');
    return response.data;
};
