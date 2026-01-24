import api from "./api";
import type { ApiResponse } from "../types";

// Types
export interface AccessRequest {
    id: string;
    doctor_id: string;
    doctor_name: string;
    doctor_speciality?: string;
    doctor_image?: string;
    requested_at: number;
}

export interface ApprovedPatient {
    id: string;
    name: string;
    email: string;
    image: string;
    approved_at: number;
}

export interface PatientReport {
    id: string;
    file_url: string;
    file_type: string;
    original_name: string;
    description: string;
    report_type: string;
    uploaded_at: number;
}

export interface Notification {
    id: string;
    type: string;
    message: string;
    data: Record<string, unknown>;
    read: boolean;
    created_at: number;
}

// User APIs
export const getPendingAccessRequests = async (): Promise<ApiResponse & { requests: AccessRequest[] }> => {
    const response = await api.get("/api/user/report-access-requests");
    return response.data;
};

export const approveAccessRequest = async (requestId: string): Promise<ApiResponse> => {
    const response = await api.post(`/api/user/report-access-requests/${requestId}/approve`);
    return response.data;
};

export const denyAccessRequest = async (requestId: string): Promise<ApiResponse> => {
    const response = await api.post(`/api/user/report-access-requests/${requestId}/deny`);
    return response.data;
};

export const getNotifications = async (): Promise<ApiResponse & { notifications: Notification[] }> => {
    const response = await api.get("/api/user/notifications");
    return response.data;
};

export const markNotificationRead = async (notifId: string): Promise<ApiResponse> => {
    const response = await api.post(`/api/user/notifications/${notifId}/read`);
    return response.data;
};

// Doctor APIs
export const requestReportAccess = async (
    userId: string,
    appointmentId: string
): Promise<ApiResponse> => {
    const response = await api.post("/api/doctor/request-report-access", {
        user_id: userId,
        appointment_id: appointmentId
    });
    return response.data;
};

export const getApprovedPatients = async (): Promise<ApiResponse & { patients: ApprovedPatient[] }> => {
    const response = await api.get("/api/doctor/approved-patients");
    return response.data;
};

export const getPatientReports = async (
    userId: string
): Promise<ApiResponse & { reports: PatientReport[] }> => {
    const response = await api.get(`/api/doctor/patient-reports/${userId}`);
    return response.data;
};
