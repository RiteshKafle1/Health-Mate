import api from "./api";
import type { ApiResponse } from "../types";

// Types for patient context
export interface PatientContext {
    sex: "male" | "female" | "unknown";
    age?: number;
    is_fasting: boolean;
    is_pregnant?: boolean;
}

// Value status enum matching backend
export type ValueStatus = "normal" | "low" | "high" | "critical_low" | "critical_high" | "unknown";

// Biomarker enrichment data from knowledge base
export interface BiomarkerEnrichment {
    summary: string;
    clinical_significance: string;
    source_url: string | null;
    verified: boolean;
}

// Structured clinical interpretation from AI
export interface StructuredInterpretation {
    analysis: string | null;
    comparison: string | null;
    main_interpretation: string | null;
    recommendations: string[];
    conclusion: string | null;
}

// Single extracted biomarker value
export interface ExtractedValue {
    biomarker_name: string;
    matched_id: string | null;
    original_value: number;
    original_unit: string;
    converted_value: number | null;
    reference_unit: string | null;
    reference_range: string | null;
    status: ValueStatus;
    interpretation: string | null;
    structured?: StructuredInterpretation | null;
    confidence: number;
    enrichment?: BiomarkerEnrichment | null;
}

// Full interpretation response
export interface InterpretResponse extends ApiResponse {
    report_id: string;
    lab_name: string | null;
    report_date: string | null;
    extracted_values: ExtractedValue[];
    summary: string | null;
    abnormal_count: number;
    critical_flags: string[];
    cached: boolean;
    processing_time_ms: number | null;
    patient_context: PatientContext;
}

// Request to interpret a report
export interface InterpretRequest {
    report_id: string;
    patient_context: PatientContext;
}

// Biomarker list item
export interface BiomarkerListItem {
    id: string;
    name: string;
    category: string;
    unit: string;
}

// Biomarkers list response
export interface BiomarkersResponse extends ApiResponse {
    count: number;
    biomarkers: BiomarkerListItem[];
}

// Health check response
export interface LabHealthResponse {
    success: boolean;
    status: string;
    biomarkers_loaded: number;
    llama_parser_configured: boolean;
    qwen_loaded: boolean;
    version: string;
}

/**
 * Interpret a lab report using AI.
 * @param reportId - MongoDB report ID
 * @param patientContext - Patient details for personalized interpretation
 */
export const interpretReport = async (
    reportId: string,
    patientContext: PatientContext
): Promise<InterpretResponse> => {
    const response = await api.post<InterpretResponse>("/api/lab/interpret", {
        report_id: reportId,
        patient_context: patientContext,
    });
    return response.data;
};

/**
 * Get a cached interpretation for a report.
 * @param reportId - MongoDB report ID
 */
export const getInterpretation = async (
    reportId: string
): Promise<InterpretResponse> => {
    const response = await api.get<InterpretResponse>(`/api/lab/interpret/${reportId}`);
    return response.data;
};

/**
 * Delete a cached interpretation to allow re-interpretation.
 * @param reportId - MongoDB report ID
 */
export const deleteInterpretation = async (
    reportId: string
): Promise<ApiResponse> => {
    const response = await api.delete<ApiResponse>(`/api/lab/interpret/${reportId}`);
    return response.data;
};

// Async job processing types
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface StartJobResponse extends ApiResponse {
    job_id: string;
    report_id: string;
}

export interface JobStatusResponse {
    job_id: string;
    report_id: string;
    status: JobStatus;
    progress: number;
    current_step: string;
    result?: InterpretResponse;
    error_message?: string;
    created_at: string;
    updated_at: string;
}

/**
 * Start an async interpretation job that runs in the background.
 * @param reportId - MongoDB report ID
 * @param patientContext - Patient details for personalized interpretation
 * @returns Job ID for status polling
 */
export const startInterpretationJob = async (
    reportId: string,
    patientContext: PatientContext
): Promise<StartJobResponse> => {
    const response = await api.post<StartJobResponse>("/api/lab/interpret/async", {
        report_id: reportId,
        patient_context: patientContext,
    });
    return response.data;
};

/**
 * Get the status of an async interpretation job.
 * @param jobId - Job ID returned from startInterpretationJob
 * @returns Job status with progress and result when complete
 */
export const getJobStatus = async (
    jobId: string
): Promise<JobStatusResponse> => {
    const response = await api.get<JobStatusResponse>(`/api/lab/interpret/status/${jobId}`);
    return response.data;
};

/**
 * List all supported biomarkers.
 * @param category - Optional category filter
 * @param search - Optional search query
 */
export const listBiomarkers = async (
    category?: string,
    search?: string
): Promise<BiomarkersResponse> => {
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    if (search) params.append("search", search);

    const queryString = params.toString();
    const url = `/api/lab/biomarkers${queryString ? `?${queryString}` : ""}`;

    const response = await api.get<BiomarkersResponse>(url);
    return response.data;
};

/**
 * Check lab interpretation service health.
 */
export const checkLabHealth = async (): Promise<LabHealthResponse> => {
    const response = await api.get<LabHealthResponse>("/api/lab/health");
    return response.data;
};

// Status color mapping for UI
export const getStatusColor = (status: ValueStatus): string => {
    switch (status) {
        case "normal":
            return "text-green-600 bg-green-50 border-green-200";
        case "low":
        case "high":
            return "text-amber-600 bg-amber-50 border-amber-200";
        case "critical_low":
        case "critical_high":
            return "text-red-600 bg-red-50 border-red-200";
        default:
            return "text-gray-600 bg-gray-50 border-gray-200";
    }
};

// Status label mapping
export const getStatusLabel = (status: ValueStatus): string => {
    switch (status) {
        case "normal":
            return "Normal";
        case "low":
            return "Low";
        case "high":
            return "High";
        case "critical_low":
            return "Critical Low ⚠️";
        case "critical_high":
            return "Critical High ⚠️";
        default:
            return "Unknown";
    }
};


/**
 * Fetch enrichment data for a biomarker on demand.
 * @param biomarkerName - Name of the biomarker
 */
export const fetchEnrichment = async (
    biomarkerName: string
): Promise<BiomarkerEnrichment> => {
    const response = await api.get<BiomarkerEnrichment>(`/api/lab/enrichment/${encodeURIComponent(biomarkerName)}`);
    return response.data;
};
