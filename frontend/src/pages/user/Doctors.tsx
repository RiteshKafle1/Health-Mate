import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllDoctors } from '../../api/doctor';
import type { Doctor } from '../../types';
import { Search, Filter, MapPin, Star, Loader2 } from 'lucide-react';
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
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-dark-50 mb-2">Find a Doctor</h1>
                <p className="text-dark-400">Browse through our list of trusted healthcare professionals</p>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or speciality..."
                        className="input-field pl-12"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
                    <select
                        value={selectedSpeciality}
                        onChange={(e) => setSelectedSpeciality(e.target.value)}
                        className="input-field pl-12 pr-8 min-w-[200px]"
                    >
                        {specialities.map((spec) => (
                            <option key={spec} value={spec}>{spec}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Doctors Grid */}
            {filteredDoctors.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-dark-400">No doctors found matching your criteria</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredDoctors.map((doctor) => (
                        <Link
                            key={doctor._id}
                            to={`/user/book/${doctor._id}`}
                            className="card-hover group"
                        >
                            {/* Doctor Image */}
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-dark-700 mb-4">
                                {doctor.image ? (
                                    <img
                                        src={doctor.image}
                                        alt={doctor.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500">
                                        <span className="text-4xl font-bold text-white">{doctor.name.charAt(0)}</span>
                                    </div>
                                )}
                                {/* Availability Badge */}
                                <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${doctor.available
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    }`}>
                                    {doctor.available ? 'Available' : 'Unavailable'}
                                </div>
                            </div>

                            {/* Doctor Info */}
                            <div>
                                <h3 className="font-semibold text-dark-100 group-hover:text-primary-400 transition-colors">
                                    Dr. {doctor.name}
                                </h3>
                                <p className="text-sm text-dark-400 mt-1">{doctor.speciality}</p>

                                <div className="flex items-center gap-4 mt-3 text-sm text-dark-300">
                                    <div className="flex items-center gap-1">
                                        <Star className="text-amber-400 fill-amber-400" size={14} />
                                        <span>{doctor.experience}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <MapPin size={14} />
                                        <span className="truncate">{doctor.address?.line1 || 'N/A'}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-dark-600">
                                    <p className="text-primary-400 font-semibold">
                                        ₹{doctor.fees} <span className="text-dark-400 font-normal text-sm">/ consultation</span>
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
