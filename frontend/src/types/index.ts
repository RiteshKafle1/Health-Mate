// User types
export interface Address {
    line1: string;
    line2: string;
}

export interface User {
    _id: string;
    name: string;
    email: string;
    phone: string;
    address: Address;
    gender: string;
    dob: string;
    image: string;
}

export interface UserCreate {
    name: string;
    email: string;
    password: string;
}

export interface UserLogin {
    email: string;
    password: string;
}

// Doctor types
export interface Doctor {
    _id: string;
    name: string;
    email?: string;
    image: string;
    speciality: string;
    degree: string;
    experience: string;
    about: string;
    available: boolean;
    fees: number;
    slots_booked: Record<string, string[]>;
    address: Address;
    date: number;
}

export interface DoctorLogin {
    email: string;
    password: string;
}

export interface DoctorUpdate {
    fees?: number;
    address?: Address;
    available?: boolean;
    about?: string;
}

// Appointment types
export interface Appointment {
    _id: string;
    userId: string;
    docId: string;
    slotDate: string;
    slotTime: string;
    userData: User;
    docData: Doctor;
    amount: number;
    date: number;
    cancelled: boolean;
    payment: boolean;
    isCompleted: boolean;
}

export interface AppointmentCreate {
    docId: string;
    slotDate: string;
    slotTime: string;
}

export interface AppointmentCancel {
    appointmentId: string;
}

// Admin types
export interface AdminLogin {
    email: string;
    password: string;
}

export interface DoctorCreate {
    name: string;
    email: string;
    password: string;
    speciality: string;
    degree: string;
    experience: string;
    about: string;
    fees: number;
    address: string;
}

// Dashboard types
export interface DashboardData {
    doctors?: number;
    appointments?: number;
    patients?: number;
    users?: number;
    earnings?: number;
    latestAppointments?: Appointment[];
}

// API Response types
export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    token?: string;
    userData?: User;
    profileData?: Doctor;
    doctors?: Doctor[];
    appointments?: Appointment[];
    dashData?: DashboardData;
    order?: RazorpayOrder;
    data?: T;
}

// Razorpay types
export interface RazorpayOrder {
    id: string;
    amount: number;
    currency: string;
}

export interface PaymentRequest {
    appointmentId: string;
}

export interface RazorpayVerify {
    razorpay_order_id: string;
}

// Auth types
export type UserRole = 'user' | 'doctor' | 'admin' | null;

export interface AuthState {
    user: User | Doctor | null;
    token: string | null;
    role: UserRole;
    isAuthenticated: boolean;
}
