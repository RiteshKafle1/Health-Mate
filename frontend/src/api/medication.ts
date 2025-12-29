import api from './api';

// Medication types with stock tracking
export interface Medication {
    _id: string;
    name: string;
    frequency: number;
    duration: string;
    timing: string;
    description?: string;
    user_id: string;
    created_at: string;
    updated_at: string;

    // Stock tracking
    total_stock?: number;
    current_stock?: number;
    dose_per_intake?: number;

    // Progress tracking
    start_date?: string;
    end_date?: string;
    is_active?: boolean;

    // Enhanced tracking fields
    purpose?: string;
    instructions?: string;
    schedule_times?: string[];  // e.g., ["08:00", "14:00", "20:00"]
    doses_taken_today?: Record<string, boolean>;  // e.g., {"08:00": true, "14:00": false}

    // Calculated fields (from backend)
    days_remaining?: number;
    stock_percentage?: number;
    duration_progress?: number;
    days_elapsed?: number;
    total_days?: number;
    stock_status?: 'healthy' | 'medium' | 'low' | 'critical' | 'out' | 'unknown';
    next_dose_time?: string;  // Next scheduled dose time
}

export interface MedicationCreate {
    name: string;
    frequency: number;
    duration: string;
    timing: string;
    description?: string;
    total_stock?: number;
    current_stock?: number;
    dose_per_intake?: number;
    start_date?: string;
    is_active?: boolean;
    // Enhanced tracking
    purpose?: string;
    instructions?: string;
    schedule_times?: string[];
}

export interface MedicationUpdate {
    name?: string;
    frequency?: number;
    duration?: string;
    timing?: string;
    description?: string;
    total_stock?: number;
    current_stock?: number;
    dose_per_intake?: number;
    start_date?: string;
    end_date?: string;
    is_active?: boolean;
    // Enhanced tracking
    purpose?: string;
    instructions?: string;
    schedule_times?: string[];
    doses_taken_today?: Record<string, boolean>;
}

export interface MedicationSummary {
    total: number;
    active: number;
    critical: number;   // Urgent (≤3 days)
    low: number;        // Low Stock (≤7 days)
    medium: number;     // Getting Low (≤14 days)
    healthy: number;    // Good (>14 days)
    out: number;        // Out of Stock
    // Legacy fields
    low_stock: number;
    out_of_stock: number;
}

export interface MedicationListResponse {
    success: boolean;
    medications: Medication[];
    summary?: MedicationSummary;
}

export interface MedicationResponse {
    success: boolean;
    message: string;
    medication?: Medication;
}

// Medication API endpoints

// Create a new medication
export const createMedication = async (data: MedicationCreate): Promise<MedicationResponse> => {
    const response = await api.post('/api/user/medications', data);
    return response.data;
};

// Get all medications for the user
export const getMedications = async (): Promise<MedicationListResponse> => {
    const response = await api.get('/api/user/medications');
    return response.data;
};

// Get low stock medications
export const getLowStockMedications = async (): Promise<MedicationListResponse> => {
    const response = await api.get('/api/user/medications/low-stock');
    return response.data;
};

// Get a specific medication by ID
export const getMedication = async (id: string): Promise<MedicationResponse> => {
    const response = await api.get(`/api/user/medications/${id}`);
    return response.data;
};

// Update a medication
export const updateMedication = async (id: string, data: MedicationUpdate): Promise<MedicationResponse> => {
    const response = await api.put(`/api/user/medications/${id}`, data);
    return response.data;
};

// Update just the stock level
export const updateStock = async (id: string, current_stock: number): Promise<MedicationResponse> => {
    const response = await api.put(`/api/user/medications/${id}/stock`, { current_stock });
    return response.data;
};

// Refill medication stock
export const refillStock = async (id: string, refill_amount: number, total_stock?: number): Promise<MedicationResponse> => {
    const response = await api.post(`/api/user/medications/${id}/refill`, {
        refill_amount,
        total_stock
    });
    return response.data;
};

// Delete a medication
export const deleteMedication = async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/api/user/medications/${id}`);
    return response.data;
};

// Mark a dose as taken or untaken
export const markDoseTaken = async (
    id: string,
    timeSlot: string,
    taken: boolean
): Promise<MedicationResponse> => {
    const response = await api.post(`/api/user/medications/${id}/dose`, {
        time_slot: timeSlot,
        taken
    });
    return response.data;
};

// Get AI-generated medication info (purpose and instructions)
export interface MedicationInfo {
    purpose: string;
    instructions: string;
    source: 'knowledge_base' | 'ai_generated' | 'fallback';
    success: boolean;
}

export const getMedicationInfo = async (medicationName: string): Promise<MedicationInfo> => {
    const response = await api.get(`/api/user/medications/info/${encodeURIComponent(medicationName)}`);
    return response.data;
};

// ============================================
// ADHERENCE TRACKING API
// ============================================

export interface AdherenceStats {
    success: boolean;
    period: string;
    start_date: string;
    end_date: string;
    summary: {
        total_doses: number;
        taken: number;
        missed: number;
        late: number;
        skipped: number;
        adherence_percentage: number;
        on_time_percentage: number;
    };
    by_medication: Record<string, {
        medication_id: string;
        taken: number;
        missed: number;
        late: number;
        skipped: number;
        total: number;
        adherence_percentage: number;
    }>;
    by_date: Record<string, {
        taken: number;
        missed: number;
        total: number;
    }>;
}

export interface MissedDose {
    medication_id: string;
    medication_name: string;
    date: string;
    time_slot: string;
    scheduled_at: string | null;
}

export interface MissedDosesResponse {
    success: boolean;
    missed_doses: MissedDose[];
    count: number;
}

export interface StreakResponse {
    success: boolean;
    current_streak: number;
    best_streak: number;
    last_broken_date: string | null;
    is_perfect_today: boolean | null;
}

export interface DoseHistoryItem {
    id: string;
    medication_id: string;
    medication_name: string;
    date: string;
    time_slot: string;
    status: 'taken' | 'missed' | 'skipped';
    was_late: boolean;
    actual_time: string | null;
    scheduled_at: string | null;
    notes: string | null;
}

export interface DoseHistoryResponse {
    success: boolean;
    history: DoseHistoryItem[];
    count: number;
}

// Get adherence statistics
export const getAdherenceStats = async (
    period: 'week' | 'month' | 'all' = 'week',
    medicationId?: string
): Promise<AdherenceStats> => {
    const params = new URLSearchParams({ period });
    if (medicationId) params.append('medication_id', medicationId);
    const response = await api.get(`/api/user/medications/adherence/stats?${params}`);
    return response.data;
};

// Get missed doses
export const getMissedDoses = async (
    limit: number = 20,
    medicationId?: string,
    startDate?: string,
    endDate?: string
): Promise<MissedDosesResponse> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (medicationId) params.append('medication_id', medicationId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const response = await api.get(`/api/user/medications/adherence/missed?${params}`);
    return response.data;
};

// Get adherence streak
export const getStreak = async (): Promise<StreakResponse> => {
    const response = await api.get('/api/user/medications/adherence/streak');
    return response.data;
};

// Get dose history
export const getDoseHistory = async (
    medicationId?: string,
    limit: number = 50,
    startDate?: string,
    endDate?: string
): Promise<DoseHistoryResponse> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (medicationId) params.append('medication_id', medicationId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const response = await api.get(`/api/user/medications/adherence/history?${params}`);
    return response.data;
};
