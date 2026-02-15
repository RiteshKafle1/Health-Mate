import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, AlertTriangle, CheckCircle, AlertCircle,
    Clock, Building2, Calendar, Printer, Share2
} from 'lucide-react';
import { BiomarkerTable } from '../../components/BiomarkerTable';
import { getInterpretation, startInterpretationJob, getJobStatus } from '../../api/labInterpret';
import type { InterpretResponse, PatientContext, JobStatus } from '../../api/labInterpret';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export function LabAnalysisPage() {
    const { reportId } = useParams();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [interpretation, setInterpretation] = useState<InterpretResponse | null>(null);
    const [activeTab, setActiveTab] = useState<'results' | 'summary'>('results');
    const [patientContext, setPatientContext] = useState<PatientContext | undefined>(undefined);

    // Progress tracking state
    const [jobId, setJobId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState("Initializing...");
    const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
    const pollingIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (reportId) {
            loadInterpretation();
        }

        // Cleanup polling on unmount
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [reportId]);

    const loadInterpretation = async () => {
        if (!reportId) return;

        try {
            setIsLoading(true);

            // First, try to get cached interpretation
            try {
                const cached = await getInterpretation(reportId);
                setInterpretation(cached);
                setPatientContext(cached.patient_context);
                setIsLoading(false);
                return;
            } catch (error: any) {
                // Not cached, start async job
                if (error.response?.status === 404) {
                    const context_payload = {
                        sex: 'unknown' as const,
                        is_fasting: false
                    };

                    // Start background job
                    const jobResponse = await startInterpretationJob(reportId, context_payload);

                    if (jobResponse.job_id === "cached") {
                        // Was cached on the server, refetch
                        const cached = await getInterpretation(reportId);
                        setInterpretation(cached);
                        setPatientContext(cached.patient_context);
                        setIsLoading(false);
                        return;
                    }

                    setJobId(jobResponse.job_id);
                    setJobStatus("pending");
                    setProgress(0);
                    setCurrentStep("Starting analysis...");

                    // Start polling
                    pollJobStatus(jobResponse.job_id);
                } else {
                    throw error;
                }
            }

        } catch (error: any) {
            toast.error('Failed to load interpretation');
            console.error(error);
            setIsLoading(false);
        }
    };

    const pollJobStatus = async (currentJobId: string) => {
        // Clear any existing interval first to prevent duplicates
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }

        // Poll every 2 seconds
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const status = await getJobStatus(currentJobId);

                // Update UI state
                setJobStatus(status.status);
                setProgress(status.progress);
                setCurrentStep(status.current_step);

                if (status.status === "completed" && status.result) {
                    // CRITICAL: Clear interval FIRST before doing anything else
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }

                    // Update state
                    setInterpretation(status.result);
                    setPatientContext(status.result.patient_context);
                    setIsLoading(false);
                    setJobId(null);

                    // Show success toast ONCE
                    toast.success("Analysis complete!");

                } else if (status.status === "failed") {
                    // Clear interval on failure
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }

                    toast.error(status.error_message || "Analysis failed");
                    setIsLoading(false);
                    setJobId(null);
                }

            } catch (error) {
                console.error("Polling error:", error);
                // Don't clear interval on network errors - keep trying
            }
        }, 2000); // Poll every 2 seconds
    };


    const handlePrint = () => {
        window.print();
    };

    // Define pipeline steps for the progress checklist
    const PIPELINE_STEPS = [
        { label: 'Preparing environment', threshold: 5 },
        { label: 'Verifying document', threshold: 15 },
        { label: 'Extracting biomarkers', threshold: 40 },
        { label: 'Validating results', threshold: 72 },
        { label: 'Generating summary', threshold: 87 },
        { label: 'Saving results', threshold: 95 },
    ];

    // Loading state is now rendered INLINE — not as a full-page takeover
    if (isLoading || !interpretation) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 lg:p-8 max-w-3xl mx-auto"
            >
                {/* Back button — always accessible */}
                <button
                    onClick={() => navigate('/user/reports')}
                    className="flex items-center gap-2 text-[#2D336B]/60 hover:text-[#2D336B] transition-colors mb-8 group"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Reports
                </button>

                {/* Loading card */}
                <div className="bg-white rounded-3xl shadow-xl border border-[#A9B5DF]/20 p-8 lg:p-10">
                    <div className="flex flex-col items-center text-center">
                        {/* Animated spinner */}
                        <div className="relative w-28 h-28 mb-8">
                            {/* Outer ring */}
                            <div
                                className="absolute inset-0 rounded-full border-4 border-[#A9B5DF]/30 animate-spin"
                                style={{ animationDuration: '3s' }}
                            >
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#7886C7] rounded-full" />
                            </div>

                            {/* Inner ring (reverse) */}
                            <div
                                className="absolute inset-4 rounded-full border-4 border-[#7886C7]/40 animate-spin"
                                style={{ animationDuration: '2s', animationDirection: 'reverse' }}
                            >
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-[#A9B5DF] rounded-full" />
                            </div>

                            {/* Center icon */}
                            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-[#7886C7] to-[#A9B5DF] animate-pulse flex items-center justify-center">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                                    />
                                </svg>
                            </div>
                        </div>

                        {/* Title */}
                        <h2 className="text-2xl font-bold text-[#2D336B] mb-1">
                            Analyzing Lab Report
                        </h2>

                        {/* Current step text */}
                        <p className="text-[#7886C7] font-medium mb-6 h-6">
                            {currentStep}
                        </p>

                        {/* Progress bar */}
                        {jobId && (
                            <div className="w-full max-w-md mb-6">
                                <div className="w-full h-2.5 bg-[#A9B5DF]/20 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-[#7886C7] to-[#A9B5DF] rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.6, ease: 'easeOut' }}
                                    />
                                </div>
                                <p className="text-sm text-[#2D336B]/50 mt-2 font-medium">{progress}% complete</p>
                            </div>
                        )}

                        {/* Step checklist */}
                        {jobId && (
                            <div className="w-full max-w-sm text-left space-y-2.5 mb-8">
                                {PIPELINE_STEPS.map((step, i) => {
                                    const isDone = progress >= step.threshold + 5;
                                    const isActive = !isDone && progress >= step.threshold - 5;

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center gap-3 text-sm transition-all duration-300 ${isDone
                                                    ? 'text-green-600'
                                                    : isActive
                                                        ? 'text-[#2D336B] font-medium'
                                                        : 'text-[#2D336B]/30'
                                                }`}
                                        >
                                            {isDone ? (
                                                <CheckCircle size={16} className="text-green-500 shrink-0" />
                                            ) : isActive ? (
                                                <div className="w-4 h-4 border-2 border-[#7886C7] border-t-transparent rounded-full animate-spin shrink-0" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-[#A9B5DF]/30 shrink-0" />
                                            )}
                                            {step.label}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Status badge */}
                        {jobStatus && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-[#7886C7]/10 text-[#2D336B] rounded-lg mb-4">
                                <Clock size={14} />
                                <span className="text-sm font-medium">
                                    {jobStatus === 'pending' && 'Queued — waiting to start'}
                                    {jobStatus === 'processing' && 'Processing in background'}
                                </span>
                            </div>
                        )}

                        {/* Navigate away hint */}
                        <p className="text-xs text-[#2D336B]/40 mt-2">
                            You can navigate away — analysis will continue in the background
                        </p>
                    </div>
                </div>
            </motion.div>
        );
    }


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

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto"
        >
            {/* Breadcrumb / Back */}
            <button
                onClick={() => navigate('/user/reports')}
                className="flex items-center gap-2 text-[#2D336B]/60 hover:text-[#2D336B] transition-colors mb-4 group"
            >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back to Reports
            </button>

            {/* Header Card */}
            <div className="bg-gradient-to-r from-[#2D336B] to-[#7886C7] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <h1 className="text-3xl font-bold">Analysis Report</h1>
                            {cached && (
                                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-medium border border-white/10">
                                    AI Generated
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-x-8 gap-y-3 text-white/80">
                            {lab_name && (
                                <span className="flex items-center gap-2">
                                    <Building2 size={16} />
                                    {lab_name}
                                </span>
                            )}
                            {report_date && (
                                <span className="flex items-center gap-2">
                                    <Calendar size={16} />
                                    {report_date}
                                </span>
                            )}
                            <span className="flex items-center gap-2 opacity-70">
                                <Clock size={16} />
                                {(processing_time_ms ? processing_time_ms / 1000 : 0).toFixed(1)}s processing
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            onClick={handlePrint}
                            className="bg-white/10 hover:bg-white/20 text-white border-none backdrop-blur-md"
                        >
                            <Printer size={18} className="mr-2" />
                            Print
                        </Button>

                    </div>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    <div className={`p-4 rounded-xl backdrop-blur-md border border-white/10 ${hasCritical ? 'bg-red-500/20' : 'bg-white/5'}`}>
                        <div className="flex items-center gap-3 mb-1">
                            {hasCritical ? <AlertTriangle className="text-red-300" /> : <CheckCircle className="text-green-300" />}
                            <span className="font-semibold text-white/90">Critical Issues</span>
                        </div>
                        <p className="text-2xl font-bold">{critical_flags.length}</p>
                    </div>

                    <div className={`p-4 rounded-xl backdrop-blur-md border border-white/10 ${hasAbnormal ? 'bg-amber-500/20' : 'bg-white/5'}`}>
                        <div className="flex items-center gap-3 mb-1">
                            <AlertCircle className={hasAbnormal ? "text-amber-300" : "text-white/60"} />
                            <span className="font-semibold text-white/90">Abnormal Values</span>
                        </div>
                        <p className="text-2xl font-bold">{abnormal_count}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
                        <div className="flex items-center gap-3 mb-1">
                            <Share2 className="text-white/60" />
                            <span className="font-semibold text-white/90">Total Biomarkers</span>
                        </div>
                        <p className="text-2xl font-bold">{extracted_values.length}</p>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-8 border-b border-[#A9B5DF]/30 px-4">
                <button
                    onClick={() => setActiveTab('results')}
                    className={`pb-4 text-lg font-medium transition-all relative ${activeTab === 'results' ? 'text-[#2D336B]' : 'text-[#2D336B]/50 hover:text-[#2D336B]'
                        }`}
                >
                    Detailed Results
                    {activeTab === 'results' && (
                        <motion.div layoutId="line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7886C7]" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`pb-4 text-lg font-medium transition-all relative ${activeTab === 'summary' ? 'text-[#2D336B]' : 'text-[#2D336B]/50 hover:text-[#2D336B]'
                        }`}
                >
                    AI Insights
                    {activeTab === 'summary' && (
                        <motion.div layoutId="line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7886C7]" />
                    )}
                </button>
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'results' ? (
                        <div className="space-y-6">
                            {hasCritical && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="text-red-800 font-bold">Critical attention required</h3>
                                        <p className="text-red-600 text-sm mt-1">
                                            The following values are at critical levels: {critical_flags.join(", ")}. Please consult a doctor immediately.
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="bg-white rounded-2xl shadow-sm border border-[#A9B5DF]/20 overflow-hidden">
                                <BiomarkerTable values={extracted_values} />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#A9B5DF]/20">
                                    <h3 className="text-xl font-bold text-[#2D336B] mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-[#7886C7] rounded-full" />
                                        Clinical Interpretation
                                    </h3>
                                    <p className="text-[#2D336B]/80 leading-relaxed text-lg whitespace-pre-wrap">
                                        {summary}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-[#FFF2F2] p-6 rounded-2xl border border-[#A9B5DF]/20">
                                    <h3 className="font-bold text-[#2D336B] mb-4">Patient Context</h3>
                                    {patientContext ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center pb-3 border-b border-[#2D336B]/5">
                                                <span className="text-[#2D336B]/60">Sex</span>
                                                <span className="font-semibold text-[#2D336B] capitalize">{patientContext.sex}</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-3 border-b border-[#2D336B]/5">
                                                <span className="text-[#2D336B]/60">Age</span>
                                                <span className="font-semibold text-[#2D336B]">{patientContext.age || '-'}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[#2D336B]/60">Fasting</span>
                                                <span className="font-semibold text-[#2D336B]">{patientContext.is_fasting ? 'Yes' : 'No'}</span>
                                            </div>
                                        </div>
                                    ) : <p className="text-sm opacity-60">No context available</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
}
