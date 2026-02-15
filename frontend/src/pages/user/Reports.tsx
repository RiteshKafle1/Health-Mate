import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Upload, FileText, Trash2, Loader2, Download,
    Image, Video, File, Calendar, X, Filter, Eye, Plus, CheckCircle2
} from 'lucide-react';
import { ReportViewerModal } from '../../components/ReportViewerModal';
import { LabInterpretButton } from '../../components/LabInterpretButton';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import {
    uploadReport, getMyReports, deleteReport,
    REPORT_TYPES
} from '../../api/reports';
import type { Report } from '../../api/reports';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring' as const, stiffness: 300, damping: 24 }
    }
};

export function Reports() {
    const navigate = useNavigate();
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteModalReport, setDeleteModalReport] = useState<Report | null>(null);

    // Upload form state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [description, setDescription] = useState('');
    const [reportType, setReportType] = useState('lab_report');
    const [dragActive, setDragActive] = useState(false);
    const [showUpload, setShowUpload] = useState(false);

    // Report viewer modal state
    const [viewingReport, setViewingReport] = useState<Report | null>(null);

    const fetchReports = useCallback(async () => {
        try {
            const response = await getMyReports(0, 50);
            if (response.success) {
                setReports(response.reports);
            }
        } catch {
            toast.error('Failed to load reports');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error('File size exceeds 10MB limit');
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error('File size exceeds 10MB limit');
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Please select a file');
            return;
        }

        setIsUploading(true);
        try {
            const response = await uploadReport(selectedFile, description, reportType);
            if (response.success) {
                toast.success('Report uploaded successfully');
                setSelectedFile(null);
                setDescription('');
                setReportType('other');
                setShowUpload(false);
                fetchReports();
            } else {
                toast.error(response.message || 'Upload failed');
            }
        } catch (_error: any) {
            toast.error(_error.response?.data?.detail || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = (report: Report, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        setDeleteModalReport(report);
    };

    const confirmDelete = async () => {
        if (!deleteModalReport) return;
        const reportId = deleteModalReport.id;
        setDeletingId(reportId);
        try {
            const response = await deleteReport(reportId);
            if (response.success) {
                toast.success('Report deleted');
                setReports(reports.filter(r => r.id !== reportId));
                setDeleteModalReport(null);
            } else {
                toast.error(response.message || 'Delete failed');
            }
        } catch (err: any) {
            console.error('Delete error:', err);
            const message = err.response?.data?.detail || err.response?.data?.message || 'Failed to delete report';
            toast.error(typeof message === 'string' ? message : JSON.stringify(message));
        } finally {
            setDeletingId(null);
        }
    };

    const getFileIcon = (fileType: string) => {
        const className = "text-[#2D336B]";
        if (fileType.startsWith('image/')) return <Image size={24} className={className} />;
        if (fileType.startsWith('video/')) return <Video size={24} className={className} />;
        if (fileType === 'application/pdf') return <FileText size={24} className={className} />;
        return <File size={24} className={className} />;
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getReportTypeLabel = (type: string) => {
        return REPORT_TYPES.find(t => t.value === type)?.label || type;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] bg-[#FFF2F2]">
                <Loader2 className="animate-spin text-[#7886C7]" size={48} />
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-[#FFF2F2] p-6 lg:p-8 relative overflow-hidden">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#A9B5DF]/10 to-transparent pointer-events-none" />
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#7886C7]/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-40 -left-20 w-72 h-72 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-7xl mx-auto space-y-8 relative z-10">
                    {/* Premium Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#2D336B]/5">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-bold text-[#2D336B] tracking-tight">My Reports</h1>
                            <p className="text-[#2D336B]/60 font-medium max-w-lg text-lg">
                                Securely manage and interpret your medical documents with AI power.
                            </p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowUpload(!showUpload)}
                            className={`
                                relative overflow-hidden px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 flex items-center gap-2.5
                                ${showUpload
                                    ? 'bg-white text-[#2D336B] border-2 border-[#2D336B]/10 hover:bg-[#F8FAFC]'
                                    : 'bg-gradient-to-r from-[#2D336B] to-[#1e234a] text-white hover:shadow-[#2D336B]/25'
                                }
                            `}
                        >
                            {showUpload ? (
                                <><X size={20} strokeWidth={2.5} /> Cancel Upload</>
                            ) : (
                                <><Plus size={20} strokeWidth={2.5} /> Upload New Report</>
                            )}
                        </motion.button>
                    </div>

                    {/* Collapsible Upload Section */}
                    <AnimatePresence>
                        {showUpload && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                                className="overflow-hidden"
                            >
                                <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-3xl p-8 shadow-card ring-1 ring-[#2D336B]/5 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#7886C7]/5 to-transparent rounded-bl-full -mr-16 -mt-16 pointer-events-none" />

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
                                        {/* Drag & Drop Zone */}
                                        <div
                                            onDragEnter={handleDrag}
                                            onDragLeave={handleDrag}
                                            onDragOver={handleDrag}
                                            onDrop={handleDrop}
                                            onClick={() => !selectedFile && document.getElementById('file-upload')?.click()}
                                            className={`
                                                relative cursor-pointer border-3 border-dashed rounded-2xl p-8 text-center transition-all duration-300
                                                flex flex-col items-center justify-center min-h-[320px]
                                                ${dragActive
                                                    ? 'border-[#7886C7] bg-[#7886C7]/5 scale-[1.01] shadow-inner'
                                                    : 'border-[#A9B5DF]/40 bg-white/40 hover:border-[#7886C7]/60 hover:bg-white/80 hover:shadow-lg hover:shadow-[#7886C7]/5'
                                                }
                                                ${selectedFile ? 'border-none bg-gradient-to-br from-white to-[#F8FAFC] shadow-card ring-1 ring-[#2D336B]/5' : ''}
                                            `}
                                        >
                                            {selectedFile ? (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="w-full h-full flex flex-col items-center justify-center"
                                                >
                                                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#FFF2F2] to-white flex items-center justify-center mb-6 shadow-soft text-[#2D336B] border border-[#2D336B]/5">
                                                        {getFileIcon(selectedFile.type)}
                                                    </div>
                                                    <p className="font-bold text-[#2D336B] text-xl mb-2 truncate px-4 max-w-full">
                                                        {selectedFile.name}
                                                    </p>
                                                    <p className="text-[#2D336B]/60 font-medium mb-8 bg-[#2D336B]/5 px-3 py-1 rounded-full text-sm">
                                                        {formatFileSize(selectedFile.size)}
                                                    </p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedFile(null);
                                                        }}
                                                        className="px-6 py-2.5 bg-red-50 text-red-500 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                                                    >
                                                        <Trash2 size={16} /> Remove File
                                                    </button>
                                                </motion.div>
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <div className="w-20 h-20 rounded-full bg-[#EBF0FF] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                                                        <Upload size={32} className="text-[#5569B8]" strokeWidth={2.5} />
                                                    </div>
                                                    <p className="text-[#2D336B] font-bold text-xl mb-3">
                                                        Drag & Drop or Click
                                                    </p>
                                                    <p className="text-[#2D336B]/50 text-sm max-w-xs mx-auto mb-8 font-medium leading-relaxed">
                                                        Upload PDF, Images, or Video<br />Max file size: 10MB
                                                    </p>
                                                    <span className="px-6 py-3 bg-[#2D336B] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#2D336B]/20 group-hover:bg-[#1e234a] transition-all">
                                                        Select Files
                                                    </span>
                                                    <input
                                                        id="file-upload"
                                                        type="file"
                                                        onChange={handleFileSelect}
                                                        accept="image/*,video/*,.pdf"
                                                        className="hidden"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Form Details */}
                                        <div className="flex flex-col justify-center space-y-8 py-4">
                                            <div>
                                                <h3 className="text-2xl font-bold text-[#2D336B] mb-2">File Details</h3>
                                                <p className="text-[#2D336B]/60">Categorize your report for better AI analysis.</p>
                                            </div>

                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-sm font-bold text-[#2D336B] mb-2.5 ml-1 uppercase tracking-wider text-[11px]">
                                                        Report Category
                                                    </label>
                                                    <div className="relative group">
                                                        <select
                                                            value={reportType}
                                                            onChange={(e) => setReportType(e.target.value)}
                                                            className="w-full h-14 rounded-2xl border border-[#A9B5DF]/50 bg-white/50 px-5 text-[#2D336B] focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all appearance-none font-semibold text-base shadow-sm group-hover:bg-white"
                                                        >
                                                            {REPORT_TYPES.map((type) => (
                                                                <option
                                                                    key={type.value}
                                                                    value={type.value}
                                                                    disabled={type.value !== 'lab_report'}
                                                                >
                                                                    {type.label} {type.value !== 'lab_report' ? '(Coming Soon)' : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <Filter className="absolute right-5 top-4 text-[#2D336B]/40 pointer-events-none" size={20} />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-bold text-[#2D336B] mb-2.5 ml-1 uppercase tracking-wider text-[11px]">
                                                        Description (Optional)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={description}
                                                        onChange={(e) => setDescription(e.target.value)}
                                                        placeholder="e.g. Annual Blood Work 2024"
                                                        className="w-full h-14 rounded-2xl border border-[#A9B5DF]/50 bg-white/50 px-5 text-[#2D336B] placeholder-[#2D336B]/30 focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all font-semibold text-base shadow-sm hover:bg-white"
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-2">
                                                <Button
                                                    onClick={handleUpload}
                                                    disabled={!selectedFile || isUploading}
                                                    isLoading={isUploading}
                                                    className={`
                                                        w-full h-14 rounded-2xl text-lg font-bold shadow-xl transition-all hover:-translate-y-1
                                                        ${!selectedFile || isUploading
                                                            ? 'bg-[#A9B5DF] cursor-not-allowed text-white/80'
                                                            : 'bg-[#7886C7] hover:bg-[#6876bf] text-white shadow-[#7886C7]/25'
                                                        }
                                                    `}
                                                >
                                                    {isUploading ? 'Securely Uploading...' : 'Upload Report'}
                                                </Button>
                                                <p className="text-center text-xs text-[#2D336B]/40 mt-4 font-medium flex items-center justify-center gap-1.5">
                                                    <CheckCircle2 size={12} /> Encrypted & HIPAA Compliant Storage
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Filters & Actions */}
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-sm text-[#2D336B] font-bold text-sm">
                                {reports.length}
                            </span>
                            <span className="text-[#2D336B]/60 font-medium">Total Documents</span>
                        </div>
                    </div>

                    {/* Reports Grid */}
                    {reports.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-24 bg-white/40 rounded-[2.5rem] border-3 border-dashed border-[#A9B5DF]/20 backdrop-blur-sm"
                        >
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-[#7886C7] shadow-xl shadow-[#7886C7]/10">
                                <FileText size={48} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-bold text-[#2D336B] mb-3">No reports yet</h3>
                            <p className="text-[#2D336B]/60 mb-8 max-w-sm mx-auto font-medium leading-relaxed">
                                Upload your medical reports to build your personal health history and get AI insights.
                            </p>
                            <Button
                                onClick={() => setShowUpload(true)}
                                className="bg-[#2D336B] text-white hover:bg-[#2D336B]/90 h-12 px-8 rounded-xl font-bold shadow-lg shadow-[#2D336B]/20"
                            >
                                <Upload size={18} className="mr-2" /> Upload First Report
                            </Button>
                        </motion.div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20"
                        >
                            <AnimatePresence>
                                {reports.map((report) => (
                                    <motion.div
                                        key={report.id}
                                        variants={itemVariants}
                                        layout
                                        className="group relative bg-white/80 backdrop-blur-xl border border-white/60 rounded-[2rem] p-6 transition-all duration-300 hover:shadow-hover hover:-translate-y-1.5 flex flex-col shadow-soft"
                                    >
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="w-14 h-14 bg-gradient-to-br from-[#F8FAFC] to-[#FFF2F2] rounded-2xl flex items-center justify-center text-[#2D336B] shadow-inner border border-white">
                                                {getFileIcon(report.file_type)}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setViewingReport(report);
                                                    }}
                                                    className="w-9 h-9 flex items-center justify-center bg-white text-[#2D336B]/70 hover:text-[#7886C7] hover:bg-[#F8FAFC] rounded-full shadow-sm border border-[#2D336B]/5 transition-all"
                                                    title="View"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <a
                                                    href={report.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-9 h-9 flex items-center justify-center bg-white text-[#2D336B]/70 hover:text-[#7886C7] hover:bg-[#F8FAFC] rounded-full shadow-sm border border-[#2D336B]/5 transition-all"
                                                    title="Download"
                                                >
                                                    <Download size={16} />
                                                </a>
                                                <button
                                                    onClick={(e) => handleDelete(report, e)}
                                                    disabled={deletingId === report.id}
                                                    className="w-9 h-9 flex items-center justify-center bg-white text-red-400 hover:text-white hover:bg-red-400 rounded-full shadow-sm border border-[#2D336B]/5 transition-all"
                                                    title="Delete"
                                                >
                                                    {deletingId === report.id ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <Trash2 size={16} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 mb-6">
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                <span className="px-2.5 py-1 bg-[#2D336B]/5 text-[#2D336B] rounded-lg text-[11px] font-bold uppercase tracking-wider">
                                                    {getReportTypeLabel(report.report_type)}
                                                </span>
                                                <span className="px-2.5 py-1 bg-white border border-[#2D336B]/10 text-[#2D336B]/60 rounded-lg text-[11px] font-bold">
                                                    {formatFileSize(report.file_size)}
                                                </span>
                                            </div>

                                            <h3 className="font-bold text-[#2D336B] text-lg leading-snug mb-2 line-clamp-2 group-hover:text-[#7886C7] transition-colors" title={report.original_name}>
                                                {report.original_name}
                                            </h3>

                                            {report.description && (
                                                <p className="text-sm text-[#2D336B]/60 line-clamp-2">
                                                    {report.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* AI Interpret Button */}
                                        {(report.file_type.startsWith('image/') || report.file_type === 'application/pdf') && (
                                            <div className="mb-4 z-20 relative">
                                                <LabInterpretButton
                                                    reportId={report.id}
                                                    className="w-full justify-center text-sm font-bold shadow-md shadow-[#7886C7]/10"
                                                    isInterpreted={report.is_interpreted}
                                                />
                                            </div>
                                        )}

                                        <div className="pt-4 mt-auto border-t border-[#2D336B]/5 flex items-center justify-between text-xs font-semibold text-[#2D336B]/40">
                                            <span className="flex items-center gap-1.5">
                                                <Calendar size={12} strokeWidth={2.5} />
                                                {formatDate(report.uploaded_at)}
                                            </span>
                                        </div>

                                        {/* Clickable overlay */}
                                        <button
                                            onClick={() => {
                                                if (report.interpretation_status === 'pending' || report.interpretation_status === 'processing') {
                                                    navigate(`/user/reports/analysis/${report.id}`);
                                                } else {
                                                    setViewingReport(report);
                                                }
                                            }}
                                            className="absolute inset-0 z-10 cursor-pointer rounded-[2rem]"
                                            aria-label={`View ${report.original_name}`}
                                        />

                                        {/* Status Badge */}
                                        {(report.interpretation_status === 'pending' || report.interpretation_status === 'processing') && (
                                            <div className="absolute top-6 left-6 z-20">
                                                <div className="bg-[#7886C7] text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center shadow-lg animate-pulse ring-2 ring-white">
                                                    <Loader2 size={10} className="animate-spin mr-1.5" />
                                                    {report.interpretation_status === 'pending' ? 'WAITING' : 'ANALYZING'}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Report Viewer Modal */}
            <ReportViewerModal
                isOpen={!!viewingReport}
                onClose={() => setViewingReport(null)}
                fileUrl={viewingReport?.file_url || ''}
                fileName={viewingReport?.original_name || ''}
                fileType={viewingReport?.file_type || ''}
            />

            {/* Delete Confirmation Modal */}
            {deleteModalReport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDeleteModalReport(null)}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-[90%] mx-4 animate-fadeIn"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Icon */}
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                            <Trash2 size={26} className="text-red-500" />
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-bold text-[#2D336B] text-center mb-2">Delete Report?</h3>

                        {/* Message */}
                        <p className="text-[#2D336B]/70 text-center mb-8 text-sm leading-relaxed">
                            Do you really want to delete{' '}
                            <span className="font-semibold text-[#2D336B]">"{deleteModalReport.original_name}"</span>?
                            This action cannot be undone.
                        </p>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModalReport(null)}
                                className="flex-1 px-5 py-3 rounded-xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deletingId === deleteModalReport.id}
                                className="flex-1 px-5 py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                            >
                                {deletingId === deleteModalReport.id ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 size={16} className="animate-spin" />
                                        Deleting...
                                    </span>
                                ) : (
                                    'Delete'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
