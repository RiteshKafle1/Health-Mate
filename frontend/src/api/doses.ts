import api from './api';

// Dose types
export interface TodayDoseItem {
    medication_id: string;
    medication_name: string;
    scheduled_time: string;
    status: 'pending' | 'available' | 'taken' | 'late' | 'missed';
    taken_at: string | null;
    time_until: number | null;  // Minutes until scheduled (if future)
    time_since: number | null;  // Minutes since scheduled (if past)
    can_take: boolean;
    dose_log_id: string | null;
}

export interface DoseSummary {
    total: number;
    taken: number;
    missed: number;
    pending: number;
    adherence_rate: number;
}

export interface TodayDosesResponse {
    success: boolean;
    date: string;
    doses: TodayDoseItem[];
    summary: DoseSummary;
}

export interface DoseSchedule {
    _id: string;
    medication_id: string;
    medication_name: string;
    scheduled_times: string[];
    is_custom: boolean;
}

export interface DoseScheduleResponse {
    success: boolean;
    schedule: DoseSchedule;
}

export interface MarkDoseResponse {
    success: boolean;
    message: string;
    log_id: string;
    status: string;
    taken_at: string;
    time_diff_minutes: number;
}

export interface DoseLogItem {
    _id: string;
    medication_id: string;
    medication_name: string;
    date: string;
    scheduled_time: string;
    status: string;
    taken_at: string | null;
}

export interface DoseHistoryResponse {
    success: boolean;
    start_date: string;
    end_date: string;
    logs: DoseLogItem[];
    adherence_rate: number;
}

// Dose API endpoints

// Get today's doses with status
export const getTodayDoses = async (): Promise<TodayDosesResponse> => {
    const response = await api.get('/api/user/doses/today');
    return response.data;
};

// Mark a dose as taken
export const markDoseTaken = async (
    medicationId: string,
    scheduledTime: string,
    takenAt?: string
): Promise<MarkDoseResponse> => {
    const params = new URLSearchParams({ scheduled_time: scheduledTime });
    if (takenAt) params.append('taken_at', takenAt);

    const response = await api.post(`/api/user/doses/${medicationId}/take?${params.toString()}`);
    return response.data;
};

// Get schedule for a medication
export const getDoseSchedule = async (medicationId: string): Promise<DoseScheduleResponse> => {
    const response = await api.get(`/api/user/doses/${medicationId}/schedule`);
    return response.data;
};

// Update custom schedule for a medication
export const updateDoseSchedule = async (
    medicationId: string,
    scheduledTimes: string[]
): Promise<{ success: boolean }> => {
    const response = await api.put(`/api/user/doses/${medicationId}/schedule`, {
        scheduled_times: scheduledTimes
    });
    return response.data;
};

// Get dose history
export const getDoseHistory = async (
    startDate?: string,
    endDate?: string,
    medicationId?: string
): Promise<DoseHistoryResponse> => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (medicationId) params.append('medication_id', medicationId);

    const response = await api.get(`/api/user/doses/history?${params.toString()}`);
    return response.data;
};
