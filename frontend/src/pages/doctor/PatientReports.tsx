import { useState, useEffect, useCallback } from 'react';
import {
    FileText, Loader2, Users, Eye, Calendar, ChevronRight,
    Image, Video, File, Download, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../../components/ui/Card';
import {
    getApprovedPatients,
    getPatientReports
} from '../../api/accessRequests';
import type { ApprovedPatient, PatientReport } from '../../api/accessRequests';

export function PatientReports() {
    const [patients, setPatients] = useState<ApprovedPatient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<ApprovedPatient | null>(null);
    const [reports, setReports] = useState<PatientReport[]>([]);
    const [isLoadingPatients, setIsLoadingPatients] = useState(true);
    const [isLoadingReports, setIsLoadingReports] = useState(false);

    const fetchPatients = useCallback(async () => {
        try {
            const response = await getApprovedPatients();
            if (response.success) {
                setPatients(response.patients);
            }
        } catch (error) {
            toast.error('Failed to load patients');
        } finally {
            setIsLoadingPatients(false);
        }
    }, []);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    const handleSelectPatient = async (patient: ApprovedPatient) => {
        setSelectedPatient(patient);
        setIsLoadingReports(true);

        try {
            const response = await getPatientReports(patient.id);
            if (response.success) {
                setReports(response.reports);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to load reports');
            setReports([]);
        } finally {
            setIsLoadingReports(false);
        }
    };

    const getFileIcon = (fileType: string) => {
        if (fileType.startsWith('image/')) return <Image size={20} className="text-blue-500" />;
        if (fileType.startsWith('video/')) return <Video size={20} className="text-purple-500" />;
        if (fileType === 'application/pdf') return <FileText size={20} className="text-red-500" />;
        return <File size={20} className="text-gray-500" />;
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (isLoadingPatients) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text">Patient Reports</h1>
                <p className="text-text-muted mt-1">
                    View lab reports from patients who have granted you access
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Patients List */}
                <Card className="p-4 lg:col-span-1">
                    <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                        <Users size={20} className="text-primary" />
                        Approved Patients ({patients.length})
                    </h2>

                    {patients.length === 0 ? (
                        <div className="text-center py-8">
                            <AlertCircle size={40} className="mx-auto text-text-muted mb-3" />
                            <p className="text-text-muted text-sm">No patients have approved access yet</p>
                            <p className="text-xs text-text-muted mt-1">
                                Request access from appointment page
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {patients.map((patient) => (
                                <button
                                    key={patient.id}
                                    onClick={() => handleSelectPatient(patient)}
                                    className={`
                                        w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left
                                        ${selectedPatient?.id === patient.id
                                            ? 'bg-primary/10 border border-primary/30'
                                            : 'hover:bg-surface/50'
                                        }
                                    `}
                                >
                                    <img
                                        src={patient.image || '/default-avatar.png'}
                                        alt={patient.name}
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-text truncate">
                                            {patient.name}
                                        </p>
                                        <p className="text-xs text-text-muted truncate">
                                            {patient.email}
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className="text-text-muted" />
                                </button>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Reports List */}
                <Card className="p-4 lg:col-span-2">
                    {!selectedPatient ? (
                        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
                            <Eye size={48} className="text-text-muted mb-4" />
                            <p className="text-text-muted">Select a patient to view their reports</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-surface">
                                <img
                                    src={selectedPatient.image || '/default-avatar.png'}
                                    alt={selectedPatient.name}
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                                <div>
                                    <h2 className="text-lg font-semibold text-text">
                                        {selectedPatient.name}'s Reports
                                    </h2>
                                    <p className="text-sm text-text-muted">
                                        Access approved on {formatDate(selectedPatient.approved_at)}
                                    </p>
                                </div>
                            </div>

                            {isLoadingReports ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                </div>
                            ) : reports.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileText size={48} className="mx-auto text-text-muted mb-4" />
                                    <p className="text-text-muted">No reports uploaded by this patient</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {reports.map((report) => (
                                        <div
                                            key={report.id}
                                            className="flex items-center gap-4 p-4 bg-surface/30 rounded-xl hover:bg-surface/50 transition-colors"
                                        >
                                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                                {getFileIcon(report.file_type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-text truncate">
                                                    {report.original_name}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={12} />
                                                        {formatDate(report.uploaded_at)}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                                                        {report.report_type}
                                                    </span>
                                                </div>
                                                {report.description && (
                                                    <p className="text-sm text-text-muted mt-1 truncate">
                                                        {report.description}
                                                    </p>
                                                )}
                                            </div>
                                            <a
                                                href={report.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                title="View/Download"
                                            >
                                                <Download size={18} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
