import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoctor } from '../../api/admin';
import { Camera, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const specialities = [
    'General physician',
    'Gynecologist',
    'Dermatologist',
    'Pediatricians',
    'Neurologist',
    'Gastroenterologist',
];

export function AddDoctor() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [speciality, setSpeciality] = useState('');
    const [degree, setDegree] = useState('');
    const [experience, setExperience] = useState('');
    const [about, setAbout] = useState('');
    const [fees, setFees] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!name || !email || !password || !speciality || !degree || !experience || !about || !fees) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('password', password);
            formData.append('speciality', speciality);
            formData.append('degree', degree);
            formData.append('experience', experience);
            formData.append('about', about);
            formData.append('fees', fees);
            formData.append('address', JSON.stringify({ line1: addressLine1, line2: addressLine2 }));

            if (imageFile) {
                formData.append('image', imageFile);
            }

            const response = await addDoctor(formData);

            if (response.success) {
                toast.success('Doctor added successfully!');
                navigate('/admin/doctors');
            } else {
                toast.error(response.message || 'Failed to add doctor');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to add doctor');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-dark-50 mb-8">Add New Doctor</h1>

            <form onSubmit={handleSubmit} className="glass-card p-8">
                {/* Profile Image */}
                <div className="flex justify-center mb-8">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-2xl overflow-hidden bg-dark-700">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Doctor" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500">
                                    <Plus className="text-white" size={32} />
                                </div>
                            )}
                        </div>
                        <label className="absolute bottom-2 right-2 p-2 rounded-lg bg-primary-500 text-white cursor-pointer hover:bg-primary-600 transition-colors">
                            <Camera size={16} />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                            />
                        </label>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                        <label className="input-label">Full Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input-field"
                            placeholder="Dr. John Doe"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="input-label">Email *</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-field"
                            placeholder="doctor@example.com"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="input-label">Password *</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field"
                            placeholder="Create a password"
                        />
                    </div>

                    {/* Speciality */}
                    <div>
                        <label className="input-label">Speciality *</label>
                        <select
                            value={speciality}
                            onChange={(e) => setSpeciality(e.target.value)}
                            className="input-field"
                        >
                            <option value="">Select Speciality</option>
                            {specialities.map((spec) => (
                                <option key={spec} value={spec}>{spec}</option>
                            ))}
                        </select>
                    </div>

                    {/* Degree */}
                    <div>
                        <label className="input-label">Degree *</label>
                        <input
                            type="text"
                            value={degree}
                            onChange={(e) => setDegree(e.target.value)}
                            className="input-field"
                            placeholder="MBBS, MD"
                        />
                    </div>

                    {/* Experience */}
                    <div>
                        <label className="input-label">Experience *</label>
                        <input
                            type="text"
                            value={experience}
                            onChange={(e) => setExperience(e.target.value)}
                            className="input-field"
                            placeholder="5 Years"
                        />
                    </div>

                    {/* Fees */}
                    <div>
                        <label className="input-label">Consultation Fee (₹) *</label>
                        <input
                            type="number"
                            value={fees}
                            onChange={(e) => setFees(e.target.value)}
                            className="input-field"
                            placeholder="500"
                            min="0"
                        />
                    </div>

                    {/* Address Line 1 */}
                    <div>
                        <label className="input-label">Clinic/Hospital</label>
                        <input
                            type="text"
                            value={addressLine1}
                            onChange={(e) => setAddressLine1(e.target.value)}
                            className="input-field"
                            placeholder="Clinic name"
                        />
                    </div>

                    {/* Address Line 2 */}
                    <div className="md:col-span-2">
                        <label className="input-label">Address</label>
                        <input
                            type="text"
                            value={addressLine2}
                            onChange={(e) => setAddressLine2(e.target.value)}
                            className="input-field"
                            placeholder="City, State"
                        />
                    </div>

                    {/* About */}
                    <div className="md:col-span-2">
                        <label className="input-label">About *</label>
                        <textarea
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                            rows={4}
                            className="input-field resize-none"
                            placeholder="Brief description about the doctor..."
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end mt-8">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Adding Doctor...
                            </>
                        ) : (
                            <>
                                <Plus size={20} />
                                Add Doctor
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
