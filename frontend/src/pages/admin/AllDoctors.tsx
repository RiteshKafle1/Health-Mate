import { useEffect, useState } from 'react';
import { getAllDoctorsAdmin, changeDoctorAvailabilityAdmin, deleteDoctorAdmin } from '../../api/admin';
import type { Doctor } from '../../types';
import {
    Search,
    Loader2,
    Filter,
    CheckCircle2,
    Clock,
    Briefcase,
    GraduationCap,
    ArrowUpDown,
    Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

export function AllDoctors() {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // filters
    const [experienceFilter, setExperienceFilter] = useState('all');
    const [sortBy, setSortBy] = useState('name'); // name, completed, pending, experience

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
        let result = [...doctors];

        // 1. Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (doc) =>
                    doc.name.toLowerCase().includes(q) ||
                    doc.speciality.toLowerCase().includes(q) ||
                    doc.email?.toLowerCase().includes(q)
            );
        }

        // 2. Experience Filter
        if (experienceFilter !== 'all') {
            result = result.filter(doc => {
                const exp = parseInt(doc.experience) || 0;
                if (experienceFilter === '5+') return exp >= 5;
                if (experienceFilter === '10+') return exp >= 10;
                if (experienceFilter === '15+') return exp >= 15;
                return true;
            });
        }

        // 3. Sorting
        result.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'experience') return (parseInt(b.experience) || 0) - (parseInt(a.experience) || 0);
            if (sortBy === 'completed') return (b.appointmentStats?.completed || 0) - (a.appointmentStats?.completed || 0);
            if (sortBy === 'pending') return (b.appointmentStats?.pending || 0) - (a.appointmentStats?.pending || 0);
            return 0;
        });

        setFilteredDoctors(result);
    }, [searchQuery, doctors, experienceFilter, sortBy]);

    const handleToggleAvailability = async (docId: string) => {
        setTogglingId(docId);
        try {
            const response = await changeDoctorAvailabilityAdmin(docId);
            if (response.success) {
                // Optimistic update
                setDoctors(doctors.map(doc =>
                    doc._id === docId ? { ...doc, available: !doc.available } : doc
                ));
                toast.success('Availability updated');
            } else {
                toast.error(response.message || 'Failed to update availability');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to update availability');
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (docId: string) => {
        if (!window.confirm('Are you sure you want to delete this doctor? This will also cancel their pending appointments.')) {
            return;
        }

        setDeletingId(docId);
        try {
            const response = await deleteDoctorAdmin(docId);
            if (response.success) {
                toast.success('Doctor deleted successfully');
                setDoctors(doctors.filter(d => d._id !== docId));
                // filteredDoctors will auto-update via useEffect or we can force it, 
                // but better to rely on doctors change triggering useEffect if we were using it for primary data,
                // however here filteredDoctors is derived but useEffect [searchQuery, doctors...] handles it.
            } else {
                toast.error(response.message || 'Failed to delete doctor');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to delete doctor');
        } finally {
            setDeletingId(null);
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
        <div className="space-y-8">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-dark-50">All Doctors</h1>
                    <p className="text-dark-400 mt-1">Manage doctor profiles and availability</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search doctors..."
                            className="pl-10 pr-4 py-2 bg-dark-800 border border-dark-700/50 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 w-64 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="p-4 glass-card flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-dark-400">
                    <Filter size={16} />
                    <span className="font-medium">Filters:</span>
                </div>

                <select
                    value={experienceFilter}
                    onChange={(e) => setExperienceFilter(e.target.value)}
                    className="px-3 py-1.5 bg-dark-700/50 border border-dark-600 rounded-lg text-dark-200 focus:outline-none focus:border-primary-500/50"
                >
                    <option value="all">All Experience</option>
                    <option value="5+">5+ Years</option>
                    <option value="10+">10+ Years</option>
                    <option value="15+">15+ Years</option>
                </select>

                <div className="w-px h-6 bg-dark-700 mx-2 hidden md:block"></div>

                <div className="flex items-center gap-2 text-dark-400">
                    <ArrowUpDown size={16} />
                    <span className="font-medium">Sort by:</span>
                </div>

                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-1.5 bg-dark-700/50 border border-dark-600 rounded-lg text-dark-200 focus:outline-none focus:border-primary-500/50"
                >
                    <option value="name">Name (A-Z)</option>
                    <option value="experience">Experience (High-Low)</option>
                    <option value="completed">Most Completed Appts</option>
                    <option value="pending">Most Pending Appts</option>
                </select>

                <div className="ml-auto text-dark-400 text-xs font-medium">
                    Showing {filteredDoctors.length} of {doctors.length} results
                </div>
            </div>

            {/* Doctors Table */}
            {filteredDoctors.length === 0 ? (
                <div className="glass-card p-16 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-dark-700/50 rounded-full flex items-center justify-center mb-4">
                        <Search className="text-dark-400" size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-dark-200">No doctors found</h3>
                    <p className="text-dark-400 mt-1 max-w-sm">
                        Try adjusting your search terms or filters to find what you're looking for.
                    </p>
                    <button
                        onClick={() => { setSearchQuery(''); setExperienceFilter('all'); }}
                        className="mt-6 px-4 py-2 text-primary-400 hover:text-primary-300 hover:underline"
                    >
                        Clear all filters
                    </button>
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-dark-700/30 border-b border-dark-700/50">
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Doctor</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Speciality</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Performance</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-dark-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-700/50">
                                {filteredDoctors.map((doctor) => (
                                    <tr key={doctor._id} className="hover:bg-dark-700/20 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-dark-700 border border-dark-600 group-hover:border-dark-500 transition-colors">
                                                    {doctor.image ? (
                                                        <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500/20 to-secondary-500/20">
                                                            <span className="text-primary-400 font-bold text-lg">{doctor.name.charAt(0)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-dark-100 group-hover:text-primary-400 transition-colors">Dr. {doctor.name}</h3>
                                                    <div className="flex items-center gap-2 text-xs text-dark-400 mt-0.5">
                                                        <Briefcase size={12} />
                                                        <span>{doctor.experience} Exp.</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-dark-200">{doctor.speciality}</span>
                                                <span className="text-xs text-dark-400 flex items-center gap-1 mt-0.5">
                                                    <GraduationCap size={12} />
                                                    {doctor.degree}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-4">
                                                <div title="Completed Appointments" className="flex items-center gap-1.5 text-sm text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-lg border border-emerald-400/20">
                                                    <CheckCircle2 size={14} />
                                                    <span className="font-medium">{doctor.appointmentStats?.completed || 0}</span>
                                                </div>
                                                <div title="Pending Appointments" className="flex items-center gap-1.5 text-sm text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                                                    <Clock size={14} />
                                                    <span className="font-medium">{doctor.appointmentStats?.pending || 0}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => handleToggleAvailability(doctor._id)}
                                                disabled={togglingId === doctor._id}
                                                className={`
                                                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-dark-900 border border-transparent
                                                    ${doctor.available ? 'bg-emerald-500' : 'bg-slate-600 border-slate-500/30'}
                                                    ${togglingId === doctor._id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                                                `}
                                            >
                                                <span
                                                    className={`
                                                        inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ring-0
                                                        ${doctor.available ? 'translate-x-6' : 'translate-x-1'}
                                                    `}
                                                />
                                            </button>
                                            <span className={`text-xs ml-3 ${doctor.available ? 'text-emerald-400' : 'text-dark-400'}`}>
                                                {doctor.available ? 'Available' : 'Unavailable'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => handleDelete(doctor._id)}
                                                disabled={deletingId === doctor._id}
                                                className="text-dark-400 hover:text-red-400 p-2 hover:bg-red-400/10 rounded-lg transition-colors"
                                                title="Delete Doctor"
                                            >
                                                {deletingId === doctor._id ? (
                                                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <Trash2 size={18} />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
