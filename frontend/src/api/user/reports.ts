import api from "./api";
import type { ApiResponse } from "../types";

export interface Report {
    id: string;
    file_url: string;
    file_type: string;
    original_name: string;
    description: string;
    report_type: string;
    file_size: number;
    uploaded_at: number;
}

export interface ReportsResponse extends ApiResponse {
    reports: Report[];
    total: number;
    skip: number;
    limit: number;
}

export interface ReportUploadResponse extends ApiResponse {
    report: {
        id: string;
        file_url: string;
        original_name: string;
        uploaded_at: number;
    };
}

// Upload a new report
export const uploadReport = async (
    file: File,
    description: string = "",
    reportType: string = "other"
): Promise<ReportUploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("description", description);
    formData.append("report_type", reportType);

    const response = await api.post<ReportUploadResponse>(
        "/api/user/reports",
        formData,
        {
            headers: { "Content-Type": "multipart/form-data" },
        }
    );
    return response.data;
};

// Get all user reports
export const getMyReports = async (
    skip: number = 0,
    limit: number = 20
): Promise<ReportsResponse> => {
    const response = await api.get<ReportsResponse>(
        `/api/user/reports?skip=${skip}&limit=${limit}`
    );
    return response.data;
};

// Get single report
export const getReport = async (reportId: string): Promise<ApiResponse> => {
    const response = await api.get(`/api/user/reports/${reportId}`);
    return response.data;
};

// Delete a report
export const deleteReport = async (reportId: string): Promise<ApiResponse> => {
    const response = await api.delete(`/api/user/reports/${reportId}`);
    return response.data;
};

// Report type options for UI
export const REPORT_TYPES = [
    { value: "lab_report", label: "Lab Report" },
    { value: "prescription", label: "Prescription" },
    { value: "xray", label: "X-Ray" },
    { value: "mri", label: "MRI Scan" },
    { value: "ct_scan", label: "CT Scan" },
    { value: "blood_test", label: "Blood Test" },
    { value: "other", label: "Other" },
];
