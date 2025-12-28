import { useState, useEffect, useCallback } from 'react';
import {
    Upload, FileText, Trash2, Loader2, Download,
    Image, Video, File, Calendar, AlertCircle, X, Check,
    Filter, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import {
    uploadReport, getMyReports, deleteReport,
    REPORT_TYPES
} from '../../api/reports';
import type { Report } from '../../api/reports';

export function Reports() {
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Upload form state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [description, setDescription] = useState('');
    const [reportType, setReportType] = useState('lab_report');
    const [dragActive, setDragActive] = useState(false);
    const [showUpload, setShowUpload] = useState(false);

    const fetchReports = useCallback(async () => {
        try {
            const response = await getMyReports(0, 50);
            if (response.success) {
                setReports(response.reports);
            }
        } catch (error) {
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
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (reportId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        if (!confirm('Are you sure you want to delete this report?')) return;

        setDeletingId(reportId);
        try {
            const response = await deleteReport(reportId);
            if (response.success) {
                toast.success('Report deleted');
                setReports(reports.filter(r => r.id !== reportId));
            } else {
                toast.error(response.message || 'Delete failed');
            }
        } catch (error: any) {
            console.error('Delete error:', error);
            const message = error.response?.data?.detail || error.response?.data?.message || 'Failed to delete report';
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
        <div className="min-h-screen bg-[#FFF2F2] p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Premium Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[#2D336B] tracking-tight">My Reports</h1>
                        <p className="text-[#2D336B]/70 mt-1 font-medium">
                            Securely manage and track your medical documents
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowUpload(!showUpload)}
                        className={`
                            shadow-lg shadow-[#7886C7]/20 border border-[#7886C7]/20 transition-all duration-300
                            ${showUpload
                                ? 'bg-[#FFF2F2] text-[#2D336B] hover:bg-[#A9B5DF]/20'
                                : 'bg-[#2D336B] text-white hover:bg-[#2D336B]/90'
                            }
                        `}
                    >
                        {showUpload ? (
                            <><X size={18} className="mr-2" /> Cancel Upload</>
                        ) : (
                            <><Upload size={18} className="mr-2" /> Upload New Report</>
                        )}
                    </Button>
                </div>

                {/* Collapsible Upload Section */}
                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showUpload ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="bg-white/60 backdrop-blur-xl border border-[#A9B5DF]/50 rounded-2xl p-6 lg:p-8 shadow-xl shadow-[#2D336B]/5 mb-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* Drag & Drop Zone */}
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                className={`
                                    relative group cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300
                                    flex flex-col items-center justify-center min-h-[240px]
                                    ${dragActive
                                        ? 'border-[#7886C7] bg-[#7886C7]/5 scale-[1.01]'
                                        : 'border-[#A9B5DF] bg-white/40 hover:border-[#7886C7]/50 hover:bg-white/60'
                                    }
                                    ${selectedFile ? 'border-none bg-[#A9B5DF]/10 ring-1 ring-[#7886C7]/20' : ''}
                                `}
                            >
                                {selectedFile ? (
                                    <div className="animate-fadeIn w-full">
                                        <div className="w-16 h-16 rounded-2xl bg-[#FFF2F2] flex items-center justify-center mx-auto mb-4 shadow-sm text-[#2D336B]">
                                            {getFileIcon(selectedFile.type)}
                                        </div>
                                        <p className="font-bold text-[#2D336B] text-lg mb-1 truncate px-4">
                                            {selectedFile.name}
                                        </p>
                                        <p className="text-[#2D336B]/60 text-sm mb-6">
                                            {formatFileSize(selectedFile.size)}
                                        </p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedFile(null);
                                            }}
                                            className="px-4 py-2 bg-[#FFF2F2] text-[#FA7070] rounded-lg text-sm font-medium hover:bg-[#FA7070]/10 transition-colors"
                                        >
                                            Remove File
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 rounded-full bg-[#A9B5DF]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                            <Upload size={28} className="text-[#2D336B]" />
                                        </div>
                                        <p className="text-[#2D336B] font-semibold text-lg mb-2">
                                            Drag & Drop your file
                                        </p>
                                        <p className="text-[#2D336B]/60 text-sm max-w-xs mx-auto mb-6">
                                            Supports PDF, Images, and Video. Max size 10MB.
                                        </p>
                                        <label className="relative">
                                            <span className="px-6 py-2.5 bg-[#2D336B] text-white rounded-lg text-sm font-medium shadow-lg shadow-[#2D336B]/20 hover:bg-[#2D336B]/90 transition-all cursor-pointer">
                                                Browse Files
                                            </span>
                                            <input
                                                type="file"
                                                onChange={handleFileSelect}
                                                accept="image/*,video/*,.pdf"
                                                className="hidden"
                                            />
                                        </label>
                                    </>
                                )}
                            </div>

                            {/* Form Details */}
                            <div className="flex flex-col justify-center space-y-6">
                                <div>
                                    <h3 className="text-xl font-bold text-[#2D336B] mb-1">File Details</h3>
                                    <p className="text-[#2D336B]/60 text-sm">Add context to your medical report</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-[#2D336B] mb-2 ml-1">
                                            Report Category
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={reportType}
                                                onChange={(e) => setReportType(e.target.value)}
                                                className="w-full h-12 rounded-xl border border-[#A9B5DF] bg-white/50 px-4 text-[#2D336B] focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all appearance-none font-medium"
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
                                            <Filter className="absolute right-4 top-3.5 text-[#2D336B]/50 pointer-events-none" size={18} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-[#2D336B] mb-2 ml-1">
                                            Description (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="e.g. Annual Blood Work 2024"
                                            className="w-full h-12 rounded-xl border border-[#A9B5DF] bg-white/50 px-4 text-[#2D336B] placeholder-[#2D336B]/30 focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <Button
                                        onClick={handleUpload}
                                        disabled={!selectedFile || isUploading}
                                        isLoading={isUploading}
                                        className="w-full h-12 bg-[#7886C7] hover:bg-[#6876bf] text-white rounded-xl shadow-lg shadow-[#7886C7]/25 text-base font-semibold transition-all hover:-translate-y-0.5"
                                    >
                                        {isUploading ? 'Uploading...' : 'Confirm Upload'}
                                    </Button>
                                    <p className="text-center text-xs text-[#2D336B]/40 mt-3">
                                        Your files are encrypted and securely stored.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters & Actions (Placeholder for now, can be expanded) */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-[#A9B5DF] text-[#2D336B] rounded-full text-xs font-bold uppercase tracking-wider">
                            Total: {reports.length}
                        </span>
                    </div>
                </div>

                {/* Reports Grid */}
                {reports.length === 0 ? (
                    <div className="text-center py-20 bg-white/30 rounded-3xl border-2 border-dashed border-[#A9B5DF]/30">
                        <div className="w-20 h-20 bg-[#A9B5DF]/20 rounded-full flex items-center justify-center mx-auto mb-6 text-[#7886C7]">
                            <FileText size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-[#2D336B] mb-2">No reports found</h3>
                        <p className="text-[#2D336B]/60 mb-6 max-w-sm mx-auto">
                            Upload your medical reports to keep them organized and accessible anytime.
                        </p>
                        <Button
                            onClick={() => setShowUpload(true)}
                            className="bg-[#2D336B] text-white hover:bg-[#2D336B]/90"
                        >
                            Upload First Report
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {reports.map((report) => (
                            <div
                                key={report.id}
                                className="group relative bg-[#A9B5DF]/10 backdrop-blur-sm border border-[#A9B5DF]/30 hover:border-[#7886C7] rounded-[20px] p-5 transition-all duration-300 hover:shadow-[0_10px_40px_-10px_rgba(120,134,199,0.2)] hover:-translate-y-1 flex flex-col"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-[#2D336B] group-hover:scale-105 transition-transform duration-300">
                                        {getFileIcon(report.file_type)}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                                        <a
                                            href={report.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-white text-[#7886C7] hover:bg-[#7886C7] hover:text-white rounded-lg shadow-sm transition-colors"
                                            title="Download"
                                        >
                                            <Download size={16} />
                                        </a>
                                        <button
                                            onClick={(e) => handleDelete(report.id, e)}
                                            disabled={deletingId === report.id}
                                            className="p-2 bg-white text-red-500 hover:bg-red-500 hover:text-white rounded-lg shadow-sm transition-colors"
                                            title="Delete"
                                        >
                                            {deletingId === report.id ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={16} />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <h3 className="font-bold text-[#2D336B] text-lg leading-tight mb-2 line-clamp-2" title={report.original_name}>
                                        {report.original_name}
                                    </h3>

                                    <div className="flex flex-wrap gap-2 mb-3">
                                        <span className="px-2.5 py-1 bg-[#2D336B]/5 text-[#2D336B] rounded-md text-xs font-semibold">
                                            {getReportTypeLabel(report.report_type)}
                                        </span>
                                        <span className="px-2.5 py-1 bg-white text-[#7886C7] border border-[#7886C7]/20 rounded-md text-xs font-semibold">
                                            {formatFileSize(report.file_size)}
                                        </span>
                                    </div>

                                    {report.description && (
                                        <p className="text-sm text-[#2D336B]/70 line-clamp-2 mb-4 min-h-[40px]">
                                            {report.description}
                                        </p>
                                    )}
                                </div>

                                <div className="pt-4 mt-auto border-t border-[#A9B5DF]/30 flex items-center justify-between text-xs font-medium text-[#2D336B]/50">
                                    <span className="flex items-center gap-1.5">
                                        <Calendar size={12} />
                                        {formatDate(report.uploaded_at)}
                                    </span>
                                    <span className="group-hover:text-[#7886C7] transition-colors">
                                        Tap to view
                                    </span>
                                </div>

                                <a
                                    href={report.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute inset-x-0 bottom-0 top-20 z-10"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
