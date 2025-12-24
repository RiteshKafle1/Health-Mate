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

    // Calculated fields (from backend)
    days_remaining?: number;
    stock_percentage?: number;
    duration_progress?: number;
    days_elapsed?: number;
    total_days?: number;
    stock_status?: 'healthy' | 'medium' | 'low' | 'critical' | 'out' | 'unknown';
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
