import { useState } from 'react';
import {
    X, AlertTriangle, CheckCircle, AlertCircle,
    Clock, Building2, Calendar, Printer, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BiomarkerTable } from './BiomarkerTable';
import type { InterpretResponse, PatientContext } from '../api/labInterpret';

interface LabResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    interpretation: InterpretResponse | null;
    patientContext?: PatientContext;
    onReinterpret?: () => void;
    isReinterpreting?: boolean;
}

export function LabResultsModal({
    isOpen,
    onClose,
    interpretation,
    patientContext,
    onReinterpret,
    isReinterpreting = false
}: LabResultsModalProps) {
    const [activeTab, setActiveTab] = useState<'results' | 'summary'>('results');

    if (!isOpen || !interpretation) return null;

    const {
        lab_name,
        report_date,
        extracted_values,
        summary,
        abnormal_count,
        critical_flags,
        cached,
        processing_time_ms
    } = interpretation;

    const hasCritical = critical_flags.length > 0;
    const hasAbnormal = abnormal_count > 0;

    const handlePrint = () => {
        window.print();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm print:hidden"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.4 }}
                        className="relative w-full max-w-5xl h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col print:max-w-none print:max-h-none print:rounded-none print:shadow-none print:h-auto"
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 bg-gradient-to-r from-[#2D336B] to-[#7886C7] p-6 text-white relative overflow-hidden">
                            {/* Decorative elements */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <h2 className="text-2xl font-bold">Lab Report Analysis</h2>
                                        {cached && (
                                            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium border border-white/20">
                                                Cached
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/90">
                                        {lab_name && (
                                            <span className="flex items-center gap-1.5 opacity-90">
                                                <Building2 size={14} />
                                                {lab_name}
                                            </span>
                                        )}
                                        {report_date && (
                                            <span className="flex items-center gap-1.5 opacity-90">
                                                <Calendar size={14} />
                                                {report_date}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1.5 opacity-70">
                                            <Clock size={14} />
                                            Generated in {(processing_time_ms ? processing_time_ms / 1000 : 0).toFixed(1)}s
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/20 rounded-lg transition-colors print:hidden"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Status Summary */}
                            <div className="mt-6 flex flex-wrap gap-3">
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    {hasCritical ? (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/90 backdrop-blur-md text-white rounded-lg shadow-lg border border-red-400/50">
                                            <AlertTriangle size={18} className="animate-pulse" />
                                            <span className="font-semibold">{critical_flags.length} Critical Issues</span>
                                        </div>
                                    ) : hasAbnormal ? (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/90 backdrop-blur-md text-white rounded-lg shadow-lg border border-amber-400/50">
                                            <AlertCircle size={18} />
                                            <span className="font-semibold">{abnormal_count} Abnormal Values</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/90 backdrop-blur-md text-white rounded-lg shadow-lg border border-green-400/50">
                                            <CheckCircle size={18} />
                                            <span className="font-semibold">All Values Normal</span>
                                        </div>
                                    )}
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/10"
                                >
                                    <span>{extracted_values.length} Biomarkers Analyzed</span>
                                </motion.div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex-shrink-0 border-b border-[#A9B5DF]/30 bg-white print:hidden px-6">
                            <div className="flex gap-1 pt-2">
                                <button
                                    onClick={() => setActiveTab('results')}
                                    className={`px-6 py-3 font-medium transition-all relative ${activeTab === 'results'
                                        ? 'text-[#2D336B]'
                                        : 'text-[#2D336B]/50 hover:text-[#2D336B]'
                                        }`}
                                >
                                    Detailed Results
                                    {activeTab === 'results' && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7886C7]"
                                        />
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('summary')}
                                    className={`px-6 py-3 font-medium transition-all relative ${activeTab === 'summary'
                                        ? 'text-[#2D336B]'
                                        : 'text-[#2D336B]/50 hover:text-[#2D336B]'
                                        }`}
                                >
                                    AI Summary
                                    {activeTab === 'summary' && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7886C7]"
                                        />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-[#FAFAFA]">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {activeTab === 'results' ? (
                                        <div className="space-y-6">
                                            {/* Critical Alerts */}
                                            {hasCritical && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm"
                                                >
                                                    <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                                                        <AlertTriangle size={20} />
                                                        Critical Values Detected
                                                    </div>
                                                    <ul className="list-disc list-inside text-red-600 text-sm space-y-1 ml-1">
                                                        {critical_flags.map((flag, index) => (
                                                            <li key={index}>{flag}</li>
                                                        ))}
                                                    </ul>
                                                    <p className="text-red-700/80 text-sm mt-3 font-medium flex items-center gap-1.5">
                                                        <AlertCircle size={14} />
                                                        Immediate medical consultation recommended.
                                                    </p>
                                                </motion.div>
                                            )}

                                            {/* Biomarker Table */}
                                            <div className="bg-white rounded-xl shadow-sm border border-[#A9B5DF]/30 overflow-hidden">
                                                <BiomarkerTable values={extracted_values} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="prose prose-slate max-w-none space-y-6">
                                            <div className="p-6 bg-white rounded-xl shadow-sm border border-[#A9B5DF]/20">
                                                <h3 className="text-xl font-bold text-[#2D336B] mb-4 flex items-center gap-2">
                                                    <div className="w-1 h-6 bg-[#7886C7] rounded-full" />
                                                    Clinical Assessment
                                                </h3>
                                                <p className="text-[#2D336B]/80 leading-relaxed text-lg">
                                                    {summary || 'No summary available.'}
                                                </p>
                                            </div>

                                            {patientContext && (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="p-4 bg-white rounded-xl border border-[#A9B5DF]/20 shadow-sm">
                                                        <span className="text-xs font-bold text-[#A9B5DF] uppercase tracking-wider">Patient Sex</span>
                                                        <p className="text-[#2D336B] font-semibold text-lg capitalize mt-1">{patientContext.sex}</p>
                                                    </div>
                                                    <div className="p-4 bg-white rounded-xl border border-[#A9B5DF]/20 shadow-sm">
                                                        <span className="text-xs font-bold text-[#A9B5DF] uppercase tracking-wider">Patient Age</span>
                                                        <p className="text-[#2D336B] font-semibold text-lg mt-1">{patientContext.age ? `${patientContext.age} years` : 'Not specified'}</p>
                                                    </div>
                                                    <div className="p-4 bg-white rounded-xl border border-[#A9B5DF]/20 shadow-sm">
                                                        <span className="text-xs font-bold text-[#A9B5DF] uppercase tracking-wider">Fasting Status</span>
                                                        <p className="text-[#2D336B] font-semibold text-lg mt-1">{patientContext.is_fasting ? 'Fasting' : 'Non-Fasting'}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex-shrink-0 p-4 bg-white border-t border-[#A9B5DF]/30 flex justify-between print:hidden">
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePrint}
                                    className="flex items-center gap-2 px-4 py-2 text-[#2D336B] bg-[#F5F7FF] hover:bg-[#EBEFFF] rounded-lg transition-colors font-medium"
                                >
                                    <Printer size={18} />
                                    Print Report
                                </button>
                                {onReinterpret && (
                                    <button
                                        onClick={onReinterpret}
                                        disabled={isReinterpreting}
                                        className="flex items-center gap-2 px-4 py-2 text-[#2D336B] hover:bg-[#F5F7FF] rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={18} className={isReinterpreting ? 'animate-spin' : ''} />
                                        Re-analyze
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-[#2D336B] text-white rounded-lg hover:bg-[#2D336B]/90 transition-colors font-medium shadow-lg shadow-[#2D336B]/20"
                            >
                                Close View
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
