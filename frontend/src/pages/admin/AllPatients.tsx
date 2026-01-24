import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllPatientsAdmin, deletePatientAdmin } from '../../api/admin';
import { User, Trash2, Search, Mail, Phone, MapPin, Calendar, Ruler, Weight, Pill, Loader2, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

interface Patient {
    _id: string;
    name: string;
    email: string;
    phone: string;
    image: string;
    gender: string;
    dob: string;
    appointmentCount: number;
    address: {
        line1: string;
        line2: string;
    };
    weight: string;
    height: string;
    activeMedsCount?: number;
}

export function AllPatients() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchParams] = useSearchParams();

    // Default filter from URL or 'all'
    const initialFilter = searchParams.get('filter') === 'med_users' ? 'med_users' : 'all';
    const [activeFilter, setActiveFilter] = useState(initialFilter);

    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchPatients = async () => {
        try {
            const response = await getAllPatientsAdmin();
            if (response.success && (response as any).patients) {
                setPatients((response as any).patients);
                setFilteredPatients((response as any).patients);
            }
        } catch (error) {
            toast.error('Failed to load patients');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    useEffect(() => {
        let filtered = patients;

        // 1. Text Search
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (patient) =>
                    patient.name.toLowerCase().includes(lowerSearch) ||
                    patient.email.toLowerCase().includes(lowerSearch) ||
                    patient.phone.includes(searchTerm)
            );
        }

        // 2. Category Filter
        if (activeFilter === 'med_users') {
            filtered = filtered.filter(p => (p.activeMedsCount || 0) > 0);
        }

        setFilteredPatients(filtered);
    }, [searchTerm, patients, activeFilter]);

    const handleDelete = async (patientId: string) => {
        if (!window.confirm('Are you sure you want to delete this patient? This action cannot be undone and will remove all their data.')) {
            return;
        }

        setDeletingId(patientId);
        try {
            const response = await deletePatientAdmin(patientId);
            if (response.success) {
                toast.success('Patient deleted successfully');
                setPatients(patients.filter(p => p._id !== patientId));
            } else {
                toast.error(response.message || 'Failed to delete patient');
            }
        } catch (error) {
            toast.error('Failed to delete patient');
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
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-dark-50">Patients</h1>
                    <p className="text-dark-400 mt-1">Manage and view all registered patients</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search patients..."
                            className="pl-10 pr-4 py-2 bg-dark-800 border border-dark-700/50 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 w-64 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 p-1 bg-dark-800/50 border border-dark-700/50 rounded-xl w-fit">
                <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'all'
                            ? 'bg-dark-700 text-dark-100 shadow-sm'
                            : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
                        }`}
                >
                    All Patients
                </button>
                <button
                    onClick={() => setActiveFilter('med_users')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'med_users'
                            ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20 shadow-sm'
                            : 'text-dark-400 hover:text-pink-400 hover:bg-pink-500/5'
                        }`}
                >
                    <Pill size={14} />
                    Active Med Users
                </button>
            </div>

            {/* Patients Table */}
            {filteredPatients.length === 0 ? (
                <div className="glass-card p-16 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-dark-700/50 rounded-full flex items-center justify-center mb-4">
                        <User className="text-dark-400" size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-dark-200">No patients found</h3>
                    <p className="text-dark-400 mt-1 max-w-sm">
                        Try adjusting your search terms or filters to find what you're looking for.
                    </p>
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1000px]">
                            <thead className="bg-dark-800">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Patient</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Contact</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Biometrics</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Stats</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-dark-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-700/50">
                                {filteredPatients.map((patient) => (
                                    <tr key={patient._id} className="hover:bg-dark-700/20 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-dark-700 flex-shrink-0 ring-1 ring-dark-600 group-hover:ring-primary-500/30 transition-all">
                                                    {patient.image ? (
                                                        <img src={patient.image} alt={patient.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                                                            <User className="text-blue-400" size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-sm text-dark-100 group-hover:text-primary-400 transition-colors">{patient.name}</h3>
                                                    <div className="flex items-center gap-2 text-xs text-dark-400 mt-0.5">
                                                        <span className="capitalize">{patient.gender}</span>
                                                        <span>•</span>
                                                        <span>{patient.dob || 'DOB N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2 text-sm text-dark-300">
                                                    <Mail size={14} className="text-dark-500" />
                                                    <span className="truncate max-w-[180px]">{patient.email}</span>
                                                </div>
                                                {patient.phone && patient.phone !== '000000000' && (
                                                    <div className="flex items-center gap-2 text-xs text-dark-400">
                                                        <Phone size={12} className="text-dark-500" />
                                                        <span>{patient.phone}</span>
                                                    </div>
                                                )}
                                                {(patient.address?.line1 || patient.address?.line2) && (
                                                    <div className="flex items-center gap-2 text-xs text-dark-400">
                                                        <MapPin size={12} className="text-dark-500" />
                                                        <span className="truncate max-w-[180px]">
                                                            {[patient.address?.line1, patient.address?.line2].filter(Boolean).join(', ')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center p-2 rounded-lg bg-dark-700/20 border border-dark-700/50 w-16">
                                                    <div className="flex items-center gap-1 text-[10px] text-dark-500 uppercase">
                                                        <Ruler size={10} /> Ht
                                                    </div>
                                                    <span className="text-sm font-medium text-dark-200">{patient.height || '-'}</span>
                                                </div>
                                                <div className="flex flex-col items-center p-2 rounded-lg bg-dark-700/20 border border-dark-700/50 w-16">
                                                    <div className="flex items-center gap-1 text-[10px] text-dark-500 uppercase">
                                                        <Weight size={10} /> Wt
                                                    </div>
                                                    <span className="text-sm font-medium text-dark-200">{patient.weight || '-'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center justify-between text-xs gap-3">
                                                    <span className="text-dark-400 flex items-center gap-1.5">
                                                        <Calendar size={12} /> Appointments
                                                    </span>
                                                    <span className="font-medium text-dark-200 bg-dark-700/50 px-2 py-0.5 rounded-md">{patient.appointmentCount || 0}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs gap-3">
                                                    <span className="text-dark-400 flex items-center gap-1.5">
                                                        <Activity size={12} /> Active Meds
                                                    </span>
                                                    <span className={`font-medium px-2 py-0.5 rounded-md ${(patient.activeMedsCount || 0) > 0 ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'bg-dark-700/50 text-dark-400'}`}>
                                                        {patient.activeMedsCount || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(patient._id)}
                                                disabled={deletingId === patient._id}
                                                className="p-2 rounded-lg hover:bg-red-500/10 text-dark-400 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"
                                                title="Delete Patient"
                                            >
                                                {deletingId === patient._id ? (
                                                    <Loader2 size={18} className="animate-spin text-red-500" />
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
