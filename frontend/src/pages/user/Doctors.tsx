import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllDoctors } from '../../api/doctor';
import type { Doctor } from '../../types';
import { Search, Filter, MapPin, Star, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const specialities = [
    'All',
    'General physician',
    'Gynecologist',
    'Dermatologist',
    'Pediatricians',
    'Neurologist',
    'Gastroenterologist',
];

export function Doctors() {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSpeciality, setSelectedSpeciality] = useState('All');

    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                const response = await getAllDoctors();
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

        fetchDoctors();
    }, []);

    useEffect(() => {
        let result = doctors;

        // Filter by speciality
        if (selectedSpeciality !== 'All') {
            result = result.filter(doc => doc.speciality === selectedSpeciality);
        }

        // Filter by search query
        if (searchQuery) {
            result = result.filter(doc =>
                doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                doc.speciality.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        setFilteredDoctors(result);
    }, [doctors, searchQuery, selectedSpeciality]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-emerald-600" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Find Doctor Hero Header - Compacted */}
            <div className="bg-white dark:bg-dark-800 rounded-3xl p-5 md:p-6 shadow-xl overflow-hidden relative">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                <div className="relative z-10 max-w-3xl">
                    <h1 className="text-2xl md:text-3xl font-bold text-emerald-900 dark:text-emerald-400 mb-2 tracking-tight">
                        Find Your Specialist
                    </h1>
                    <p className="text-dark-400 text-sm md:text-base mb-5 leading-relaxed font-medium">
                        Connect with top-rated medical professionals freely. <span className="text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-900/20 px-2 rounded-md">100% Free Consultations</span>.
                    </p>

                    {/* Search and Filter Bar - Shadows & No Borders - Compacted */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1 group">
                            <div className="bg-white dark:bg-dark-800 rounded-xl flex items-center shadow-[0_2px_15px_-2px_rgba(0,0,0,0.08)] hover:shadow-lg transition-all duration-300">
                                <Search className="text-emerald-500 ml-4" size={18} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search doctor or speciality..."
                                    className="w-full bg-transparent border-none py-3 px-3 text-dark-100 placeholder-dark-300 font-medium focus:outline-none focus:ring-0 text-sm"
                                />
                            </div>
                        </div>
                        <div className="relative min-w-[200px] group">
                            <div className="bg-white dark:bg-dark-800 rounded-xl flex items-center shadow-[0_2px_15px_-2px_rgba(0,0,0,0.08)] hover:shadow-lg transition-all duration-300">
                                <Filter className="text-emerald-500 ml-4 pointer-events-none" size={18} />
                                <select
                                    value={selectedSpeciality}
                                    onChange={(e) => setSelectedSpeciality(e.target.value)}
                                    className="w-full bg-transparent border-none py-3 pl-2 pr-8 text-dark-100 font-medium cursor-pointer focus:outline-none focus:ring-0 appearance-none text-sm"
                                >
                                    {specialities.map((spec) => (
                                        <option key={spec} value={spec}>{spec}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500">
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Doctors Grid */}
            {filteredDoctors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-white/50 rounded-3xl border border-dashed border-dark-200">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                        <Search className="text-emerald-400" size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-dark-100 mb-1">No doctors found</h3>
                    <p className="text-sm text-dark-400 max-w-sm mx-auto">
                        We couldn't find any doctors matching your search.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredDoctors.map((doctor) => (
                        <Link
                            key={doctor._id}
                            to={`/user/book/${doctor._id}`}
                            className="bg-white dark:bg-dark-800 rounded-[1.5rem] overflow-hidden shadow-lg hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-300 group flex flex-col h-full relative"
                        >
                            {/* Doctor Image Area - Reduced Height */}
                            <div className="relative h-48 bg-emerald-50 dark:bg-dark-700 overflow-hidden">
                                {doctor.image ? (
                                    <img
                                        src={doctor.image}
                                        alt={doctor.name}
                                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-dark-700 dark:to-dark-800">
                                        <span className="text-5xl font-bold text-emerald-600/30">
                                            {doctor.name.charAt(0)}
                                        </span>
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 transition-opacity duration-300"></div>

                                {/* Status Badge - High Contrast */}
                                <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-bold shadow-md ${doctor.available
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-white/90 text-rose-500 backdrop-blur-md'
                                    }`}>
                                    {doctor.available ? 'Available' : 'Unavailable'}
                                </div>

                                {/* Floating Info on Image */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 pt-10 bg-gradient-to-t from-black/90 to-transparent">
                                    <h3 className="text-xl font-bold text-white mb-0.5 truncate drop-shadow-sm">
                                        Dr. {doctor.name}
                                    </h3>
                                    <p className="text-emerald-200 text-xs font-semibold tracking-wide uppercase">{doctor.speciality}</p>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="p-4 flex-1 flex flex-col">
                                <div className="flex items-center gap-3 text-xs text-dark-500 mb-4">
                                    <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/10 px-2 py-0.5 rounded-md">
                                        <Star className="text-amber-500 fill-amber-500" size={12} />
                                        <span className="font-bold text-amber-700 dark:text-amber-500">{doctor.experience} Exp.</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 truncate text-dark-400 font-medium">
                                        <MapPin size={12} className="flex-shrink-0 text-emerald-500" />
                                        <span className="truncate">{doctor.address?.line1 || 'Main Clinic'}</span>
                                    </div>
                                </div>

                                <div className="mt-auto flex items-center justify-between pt-3 border-t border-dashed border-gray-100 dark:border-dark-700">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-dark-400 uppercase tracking-widest font-bold">Consultation</span>
                                        <span className="text-emerald-600 font-extrabold text-base">
                                            Free
                                        </span>
                                    </div>

                                    <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300 shadow-sm">
                                        <ArrowRight size={16} />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
