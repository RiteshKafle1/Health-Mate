import api from "./api";
import type {
  UserCreate,
  UserLogin,
  ApiResponse,
  AppointmentCreate,
} from "../types";

// User authentication
export const registerUser = async (data: UserCreate): Promise<ApiResponse> => {
  const response = await api.post("/api/user/register", data);
  return response.data;
};

export const loginUser = async (data: UserLogin): Promise<ApiResponse> => {
  const response = await api.post("/api/user/login", data);
  return response.data;
};

// User profile
export const getUserProfile = async (): Promise<ApiResponse> => {
  const response = await api.get("/api/user/get-profile");
  return response.data;
};

export const updateUserProfile = async (
  formData: FormData
): Promise<ApiResponse> => {
  const response = await api.post("/api/user/update-profile", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

// Appointments
export const bookAppointment = async (
  data: AppointmentCreate
): Promise<ApiResponse> => {
  const response = await api.post("/api/user/book-appointment", data);
  return response.data;
};

export const getUserAppointments = async (): Promise<ApiResponse> => {
  const response = await api.get("/api/user/appointments");
  return response.data;
};

export const cancelUserAppointment = async (
  appointmentId: string
): Promise<ApiResponse> => {
  const response = await api.post("/api/user/cancel-appointment", {
    appointmentId,
  });
  return response.data;
};

// Payments
export const createRazorpayOrder = async (
  appointmentId: string
): Promise<ApiResponse> => {
  const response = await api.post("/api/user/payment-razorpay", {
    appointmentId,
  });
  return response.data;
};

export const verifyRazorpayPayment = async (
  razorpay_order_id: string
): Promise<ApiResponse> => {
  const response = await api.post("/api/user/verifyRazorpay", {
    razorpay_order_id,
  });
  return response.data;
};

export interface FileResponse {
  fileUrl: string;
}

// 🔼 Upload profile file
export const getMyFile = async (): Promise<ApiResponse<FileResponse>> => {
    const response = await api.get<ApiResponse<FileResponse>>("/api/user/me/file");
    return response.data;
};

export const uploadMyFile = async (file: File): Promise<ApiResponse<FileResponse>> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<ApiResponse<FileResponse>>(
        "/api/user/upload-file",
        formData,
        {
            headers: { "Content-Type": "multipart/form-data" },
        }
    );

    return response.data;
};
