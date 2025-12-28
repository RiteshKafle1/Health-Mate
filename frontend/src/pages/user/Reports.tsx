import { useState, useEffect, useCallback } from 'react';
import {
    Upload, FileText, Trash2, Loader2, Download,
    Image, Video, File, Calendar, AlertCircle, X, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../../components/ui/Card';
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
    const [reportType, setReportType] = useState('other');
    const [dragActive, setDragActive] = useState(false);

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

    const handleDelete = async (reportId: string) => {
        if (!confirm('Are you sure you want to delete this report?')) return;

        setDeletingId(reportId);
        try {
            const response = await deleteReport(reportId);
            if (response.success) {
                toast.success('Report deleted');
                setReports(reports.filter(r => r.id !== reportId));
            }
        } catch (error) {
            toast.error('Failed to delete report');
        } finally {
            setDeletingId(null);
        }
    };

    const getFileIcon = (fileType: string) => {
        if (fileType.startsWith('image/')) return <Image size={24} className="text-blue-500" />;
        if (fileType.startsWith('video/')) return <Video size={24} className="text-purple-500" />;
        if (fileType === 'application/pdf') return <FileText size={24} className="text-red-500" />;
        return <File size={24} className="text-gray-500" />;
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
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
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text">My Lab Reports</h1>
                <p className="text-text-muted mt-1">
                    Upload and manage your medical reports securely
                </p>
            </div>

            {/* Upload Section */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                    <Upload size={20} className="text-primary" />
                    Upload New Report
                </h2>

                <div className="space-y-4">
                    {/* Drag & Drop Zone */}
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`
                            border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                            ${dragActive
                                ? 'border-primary bg-primary/5'
                                : 'border-surface hover:border-primary/50'
                            }
                            ${selectedFile ? 'bg-green-50 border-green-300' : ''}
                        `}
                    >
                        {selectedFile ? (
                            <div className="flex items-center justify-center gap-4">
                                <Check size={24} className="text-green-500" />
                                <div className="text-left">
                                    <p className="font-medium text-text">{selectedFile.name}</p>
                                    <p className="text-sm text-text-muted">
                                        {formatFileSize(selectedFile.size)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="p-1 hover:bg-red-100 rounded-full transition-colors"
                                >
                                    <X size={18} className="text-red-500" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Upload size={40} className="mx-auto text-text-muted mb-4" />
                                <p className="text-text-muted mb-2">
                                    Drag and drop your file here, or
                                </p>
                                <label className="inline-block">
                                    <span className="text-primary cursor-pointer hover:underline">
                                        browse files
                                    </span>
                                    <input
                                        type="file"
                                        onChange={handleFileSelect}
                                        accept="image/*,video/*,.pdf"
                                        className="hidden"
                                    />
                                </label>
                                <p className="text-xs text-text-muted mt-2">
                                    Supported: Images, PDF, Videos (max 10MB)
                                </p>
                            </>
                        )}
                    </div>

                    {/* Report Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">
                                Report Type
                            </label>
                            <select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                                className="w-full h-11 rounded-lg border border-surface bg-white/50 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                            >
                                {REPORT_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">
                                Description (optional)
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g., Blood test from City Hospital"
                                className="w-full h-11 rounded-lg border border-surface bg-white/50 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleUpload}
                        disabled={!selectedFile || isUploading}
                        isLoading={isUploading}
                        className="w-full md:w-auto gap-2"
                    >
                        <Upload size={18} />
                        Upload Report
                    </Button>
                </div>
            </Card>

            {/* Reports List */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-primary" />
                    Your Reports ({reports.length})
                </h2>

                {reports.length === 0 ? (
                    <div className="text-center py-12">
                        <AlertCircle size={48} className="mx-auto text-text-muted mb-4" />
                        <p className="text-text-muted">No reports uploaded yet</p>
                        <p className="text-sm text-text-muted mt-1">
                            Upload your first lab report above
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reports.map((report) => (
                            <div
                                key={report.id}
                                className="flex items-center gap-4 p-4 bg-surface/30 rounded-xl hover:bg-surface/50 transition-colors"
                            >
                                {/* File Icon */}
                                <div className="p-3 bg-white rounded-lg shadow-sm">
                                    {getFileIcon(report.file_type)}
                                </div>

                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-text truncate">
                                        {report.original_name}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-text-muted">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            {formatDate(report.uploaded_at)}
                                        </span>
                                        <span>{formatFileSize(report.file_size)}</span>
                                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                                            {getReportTypeLabel(report.report_type)}
                                        </span>
                                    </div>
                                    {report.description && (
                                        <p className="text-sm text-text-muted mt-1 truncate">
                                            {report.description}
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <a
                                        href={report.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                        title="View/Download"
                                    >
                                        <Download size={18} />
                                    </a>
                                    <button
                                        onClick={() => handleDelete(report.id)}
                                        disabled={deletingId === report.id}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        title="Delete"
                                    >
                                        {deletingId === report.id ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
