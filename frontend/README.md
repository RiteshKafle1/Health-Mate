# Appointy - Doctor Appointment Booking Frontend

A modern, production-ready React frontend for the health appointment booking system.

## 🚀 Features

- **Multi-Role Authentication**: Separate login flows for Patients, Doctors, and Admins
- **Patient Portal**: Browse doctors, book appointments, manage bookings, make payments
- **Doctor Dashboard**: View appointments, manage availability, track earnings
- **Admin Panel**: Add doctors, manage platform, view analytics
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Modern UI**: Dark theme with glassmorphism effects and smooth animations

## 🛠️ Tech Stack

- **React 18** + **TypeScript**
- **Vite** - Fast build tool
- **TailwindCSS** - Utility-first styling
- **React Router v6** - Client-side routing
- **React Query** - Data fetching & caching
- **Axios** - HTTP client
- **Recharts** - Dashboard charts
- **Lucide React** - Icons
- **React Hot Toast** - Notifications

## 📦 Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_RAZORPAY_KEY=your_razorpay_key_id  # Optional
```

## 🔐 Default Routes

### Public
- `/login` - Login page with role selection
- `/register` - User registration
- `/doctors` - Browse doctors

### Patient (User)
- `/user/dashboard` - Dashboard
- `/user/doctors` - Find doctors
- `/user/book/:doctorId` - Book appointment
- `/user/appointments` - My appointments
- `/user/profile` - Profile settings

### Doctor
- `/doctor/dashboard` - Dashboard with stats
- `/doctor/appointments` - Manage appointments
- `/doctor/profile` - Profile settings

### Admin
- `/admin/dashboard` - Platform analytics
- `/admin/add-doctor` - Add new doctor
- `/admin/doctors` - Manage doctors
- `/admin/appointments` - All appointments

## 🎨 Project Structure

```
src/
├── api/           # API service layer
├── components/    # Reusable UI components
│   └── layout/    # Layout components (Navbar, Sidebar)
├── context/       # React Context providers
├── pages/         # Route pages by role
│   ├── user/
│   ├── doctor/
│   └── admin/
├── types/         # TypeScript interfaces
├── App.tsx        # Main app with routing
└── index.css      # Global styles
```

## 🔗 Backend API

This frontend is designed to work with the FastAPI backend located at `backend_fastapi/`. 

Make sure the backend is running on the URL specified in `VITE_API_BASE_URL`.

## 📱 Responsive Design

The UI is fully responsive and optimized for:
- Desktop (1280px+)
- Tablet (768px - 1279px)
- Mobile (< 768px)

## 🎯 Key Design Decisions

1. **Role-based routing**: Protected routes check user role before rendering
2. **Token storage**: Separate localStorage keys for each role (token, dtoken, atoken)
3. **API interceptors**: Automatic token attachment based on current role
4. **Glass morphism UI**: Modern dark theme with blur effects and gradients

## 📄 License

MIT
