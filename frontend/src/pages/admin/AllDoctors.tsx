import { useEffect, useState } from 'react';
import { getAllDoctorsAdmin, changeDoctorAvailabilityAdmin } from '../../api/admin';
import type { Doctor } from '../../types';
import { Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function AllDoctors() {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const fetchDoctors = async () => {
        try {
            const response = await getAllDoctorsAdmin();
            if (response.success && response.doctors) {
                setDoctors(response.doctors);
                setFilteredDoctors(response.doctors);
            }
        } catch (error) {
            toast.error('Failed to load doctors');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDoctors();
    }, []);

    useEffect(() => {
        if (searchQuery) {
            const filtered = doctors.filter(
                (doc) =>
                    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    doc.speciality.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    doc.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredDoctors(filtered);
        } else {
            setFilteredDoctors(doctors);
        }
    }, [searchQuery, doctors]);

    const handleToggleAvailability = async (docId: string) => {
        setTogglingId(docId);
        try {
            const response = await changeDoctorAvailabilityAdmin(docId);
            if (response.success) {
                toast.success('Availability updated');
                fetchDoctors();
            } else {
                toast.error(response.message || 'Failed to update availability');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to update availability');
        } finally {
            setTogglingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-dark-50">All Doctors</h1>
                    <p className="text-dark-400 mt-1">{doctors.length} doctors registered</p>
                </div>

                {/* Search */}
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search doctors..."
                        className="input-field pl-12"
                    />
                </div>
            </div>

            {/* Doctors Table */}
            {filteredDoctors.length === 0 ? (
                <div className="glass-card p-16 text-center">
                    <p className="text-dark-400">No doctors found</p>
                </div>
            ) : (
                <div className="table-container overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead>
                            <tr>
                                <th className="table-header">Doctor</th>
                                <th className="table-header">Speciality</th>
                                <th className="table-header">Experience</th>
                                <th className="table-header">Fees</th>
                                <th className="table-header">Status</th>
                                <th className="table-header">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDoctors.map((doctor) => (
                                <tr key={doctor._id} className="table-row">
                                    <td className="table-cell">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-dark-700 flex-shrink-0">
                                                {doctor.image ? (
                                                    <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500">
                                                        <span className="text-white font-medium">{doctor.name.charAt(0)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-dark-100">Dr. {doctor.name}</p>
                                                <p className="text-sm text-dark-400">{doctor.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <span className="text-primary-400">{doctor.speciality}</span>
                                    </td>
                                    <td className="table-cell">{doctor.experience}</td>
                                    <td className="table-cell font-medium">₹{doctor.fees}</td>
                                    <td className="table-cell">
                                        <span className={`badge ${doctor.available ? 'badge-success' : 'badge-danger'}`}>
                                            {doctor.available ? 'Available' : 'Unavailable'}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <button
                                            onClick={() => handleToggleAvailability(doctor._id)}
                                            disabled={togglingId === doctor._id}
                                            className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${doctor.available ? 'bg-emerald-500' : 'bg-dark-600'}
                        ${togglingId === doctor._id ? 'opacity-50' : ''}
                      `}
                                        >
                                            <div
                                                className={`
                          absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200
                          ${doctor.available ? 'translate-x-7' : 'translate-x-1'}
                        `}
                                            />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
