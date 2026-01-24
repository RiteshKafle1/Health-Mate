import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoctor } from '../../api/admin';
import {
    Camera,
    Loader2,
    Plus,
    User,
    Stethoscope,
    MapPin,
    Upload,
    X,
    FileText,
    ArrowLeft,
    CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

const specialities = [
    'General physician', 'Gynecologist', 'Dermatologist',
    'Pediatricians', 'Neurologist', 'Gastroenterologist',
];

export function AddDoctor() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [speciality, setSpeciality] = useState('');
    const [degree, setDegree] = useState('');
    const [experience, setExperience] = useState('');
    const [about, setAbout] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password || !speciality || !degree) {
            toast.error('Required fields missing');
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
            formData.append('fees', '0');
            formData.append('address', JSON.stringify({ line1: addressLine1, line2: addressLine2 }));
            if (imageFile) formData.append('image', imageFile);

            const response = await addDoctor(formData);
            if (response.success) {
                toast.success('Doctor Profile Created');
                navigate('/admin/doctors');
            }
        } catch (error: any) {
            toast.error('Error creating profile');
        } finally {
            setIsLoading(false);
        }
    };

    const inputStyles = "w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-semibold text-zinc-900 text-sm transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none placeholder:text-zinc-400";
    const labelStyles = "text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block ml-1";

    return (
        <div className="h-screen bg-zinc-50 p-6 overflow-hidden flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-600"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Create Professional Profile</h1>
                        <p className="text-sm text-zinc-500 font-medium">Add a new medical practitioner to the network</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-xl shadow-zinc-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        {isLoading ? 'Processing...' : 'Publish Profile'}
                    </button>
                </div>
            </div>

            {/* Main Application Interface */}
            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                
                {/* Left: Avatar & Identity Card */}
                <div className="col-span-3 flex flex-col gap-6">
                    <div className="bg-white border border-zinc-200 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm">
                        <div className="relative group mb-6">
                            <label className="cursor-pointer block">
                                <input type="file" onChange={handleImageChange} className="hidden" />
                                <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden ring-4 ring-zinc-50 shadow-2xl transition-transform group-hover:scale-[1.03]">
                                    {imagePreview ? (
                                        <img src={imagePreview} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-100 flex flex-col items-center justify-center text-zinc-400">
                                            <Upload size={32} strokeWidth={1.5} />
                                            <span className="text-xs font-bold mt-2">UPLOAD PHOTO</span>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-indigo-600 p-3 rounded-2xl text-white shadow-lg group-hover:bg-indigo-700 transition-colors">
                                    <Camera size={20} />
                                </div>
                            </label>
                        </div>
                        <h2 className="text-xl font-black text-zinc-900 leading-tight">
                            {name ? `Dr. ${name.split(' ')[0]}` : 'New Practitioner'}
                        </h2>
                        <span className="mt-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full">
                            {speciality || 'Awaiting Speciality'}
                        </span>
                    </div>

                    <div className="bg-zinc-900 rounded-3xl p-6 text-white flex-1 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-sm font-bold mb-4 opacity-50 uppercase tracking-tighter">Completion Status</h3>
                            <div className="space-y-4">
                                {[
                                    { label: 'Basic Info', done: !!name && !!email },
                                    { label: 'Credentials', done: !!degree && !!speciality },
                                    { label: 'Biography', done: about.length > 20 }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${item.done ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]' : 'bg-zinc-700'}`} />
                                        <span className={`text-xs font-bold ${item.done ? 'text-white' : 'text-zinc-500'}`}>{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
                    </div>
                </div>

                {/* Center & Right: Form Fields */}
                <div className="col-span-9 grid grid-cols-2 gap-6 h-full min-h-0">
                    
                    {/* Primary Information */}
                    <div className="bg-white border border-zinc-200 rounded-3xl p-7 shadow-sm flex flex-col">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-zinc-900 rounded-lg text-white">
                                <User size={18} />
                            </div>
                            <h3 className="font-black text-zinc-900 uppercase text-xs tracking-widest">Account & Identity</h3>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className={labelStyles}>Full Legal Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputStyles} placeholder="e.g. Dr. Julian Bashir" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelStyles}>Email Address</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyles} placeholder="bashir@clinic.com" />
                                </div>
                                <div>
                                    <label className={labelStyles}>System Password</label>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyles} placeholder="••••••••" />
                                </div>
                            </div>
                            <div className="h-px bg-zinc-100 my-2" />
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-zinc-900 rounded-lg text-white">
                                    <Stethoscope size={18} />
                                </div>
                                <h3 className="font-black text-zinc-900 uppercase text-xs tracking-widest">Medical Credentials</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className={labelStyles}>Medical Speciality</label>
                                    <select value={speciality} onChange={(e) => setSpeciality(e.target.value)} className={inputStyles}>
                                        <option value="">Select Speciality...</option>
                                        {specialities.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelStyles}>Degree / Certification</label>
                                    <input type="text" value={degree} onChange={(e) => setDegree(e.target.value)} className={inputStyles} placeholder="MD, PhD" />
                                </div>
                                <div>
                                    <label className={labelStyles}>Years of Experience</label>
                                    <input type="text" value={experience} onChange={(e) => setExperience(e.target.value)} className={inputStyles} placeholder="12+ Years" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Information */}
                    <div className="bg-white border border-zinc-200 rounded-3xl p-7 shadow-sm flex flex-col min-h-0">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-zinc-900 rounded-lg text-white">
                                <MapPin size={18} />
                            </div>
                            <h3 className="font-black text-zinc-900 uppercase text-xs tracking-widest">Clinic Location</h3>
                        </div>

                        <div className="space-y-5 flex-1 flex flex-col">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelStyles}>Medical Center</label>
                                    <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputStyles} placeholder="Central Hospital" />
                                </div>
                                <div>
                                    <label className={labelStyles}>City / District</label>
                                    <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputStyles} placeholder="Baneshwor,Kathmandu" />
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col">
                                <div className="flex items-center gap-2 mb-3 mt-4">
                                    <div className="p-2 bg-zinc-900 rounded-lg text-white">
                                        <FileText size={18} />
                                    </div>
                                    <h3 className="font-black text-zinc-900 uppercase text-xs tracking-widest">Professional Bio</h3>
                                </div>
                                <textarea 
                                    value={about} 
                                    onChange={(e) => setAbout(e.target.value)} 
                                    className={`${inputStyles} flex-1 resize-none py-4 leading-relaxed`} 
                                    placeholder="Describe the doctor's background, philosophy, and expertise..."
                                />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}