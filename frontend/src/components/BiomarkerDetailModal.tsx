
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import type { ExtractedValue, BiomarkerEnrichment } from '../api/labInterpret';
import { getStatusColor, getStatusLabel, fetchEnrichment } from '../api/labInterpret';

interface BiomarkerDetailModalProps {
    biomarker: ExtractedValue | null;
    isOpen: boolean;
    onClose: () => void;
}

export function BiomarkerDetailModal({ biomarker, isOpen, onClose }: BiomarkerDetailModalProps) {
    const [enrichment, setEnrichment] = useState<BiomarkerEnrichment | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    // Reset state when biomarker changes
    useEffect(() => {
        if (biomarker && isOpen) {
            // Check if enrichment is already present
            if (biomarker.enrichment) {
                setEnrichment(biomarker.enrichment);
                setLoading(false);
                setError(false);
            } else {
                // Fetch on demand
                setLoading(true);
                setError(false);
                setEnrichment(null);

                fetchEnrichment(biomarker.biomarker_name)
                    .then(data => {
                        setEnrichment(data);
                        setLoading(false);
                    })
                    .catch(err => {
                        console.error("Failed to fetch enrichment:", err);
                        setError(true);
                        setLoading(false);
                    });
            }
        }
    }, [biomarker, isOpen]);

    if (!biomarker) return null;

    const statusColor = getStatusColor(biomarker.status);
    const statusLabel = getStatusLabel(biomarker.status);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-40"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full md:w-[500px] bg-white shadow-2xl z-50 overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                            <h2 className="text-xl font-bold text-[#2D336B]">
                                {biomarker.biomarker_name}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-600" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Enrichment Section (Lazy Loaded) */}
                            {loading ? (
                                <div className="space-y-4 animate-pulse">
                                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                                    <div className="h-20 bg-gray-100 rounded"></div>
                                    <div className="flex items-center gap-2 text-sm text-[#7886C7]">
                                        <Loader2 size={16} className="animate-spin" />
                                        Analyzing medical database...
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                                    <AlertCircle size={24} className="text-red-400 mx-auto mb-2" />
                                    <p className="text-sm text-red-600">
                                        Could not retrieve additional information at this time.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setLoading(true);
                                            setError(false);
                                            fetchEnrichment(biomarker.biomarker_name)
                                                .then(data => {
                                                    setEnrichment(data);
                                                    setLoading(false);
                                                })
                                                .catch(() => {
                                                    setError(true);
                                                    setLoading(false);
                                                });
                                        }}
                                        className="mt-2 text-xs text-red-700 underline"
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : enrichment ? (
                                <div className="space-y-4">
                                    {/* Summary */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                            What is this?
                                        </h3>
                                        <p className="text-gray-700 leading-relaxed">
                                            {enrichment.summary}
                                        </p>
                                    </div>

                                    {/* Clinical Significance */}
                                    {enrichment.clinical_significance && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                                Why it matters
                                            </h3>
                                            <p className="text-gray-700 leading-relaxed">
                                                {enrichment.clinical_significance}
                                            </p>
                                        </div>
                                    )}

                                    {/* Source */}
                                    {enrichment.source_url && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <a
                                                href={enrichment.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[#7886C7] hover:underline flex items-center gap-1"
                                            >
                                                <ExternalLink size={14} />
                                                Learn more
                                            </a>
                                            {!enrichment.verified && (
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                                    Wikipedia / AI
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                                    <AlertCircle size={24} className="text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600">
                                        No additional information available for this biomarker.
                                    </p>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-gray-200" />

                            {/* Last Result */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                                    Last Result
                                </h3>
                                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                    {/* Value */}
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-gray-600">Value</span>
                                        <span className="text-2xl font-bold text-[#2D336B]">
                                            {biomarker.converted_value || biomarker.original_value}{' '}
                                            <span className="text-base font-normal text-gray-600">
                                                {biomarker.reference_unit || biomarker.original_unit}
                                            </span>
                                        </span>
                                    </div>

                                    {/* Status */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Status</span>
                                        <span
                                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}
                                        >
                                            {statusLabel}
                                        </span>
                                    </div>

                                    {/* Reference Range */}
                                    {biomarker.reference_range && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Normal Range</span>
                                            <span className="font-medium text-gray-800">
                                                {biomarker.reference_range}{' '}
                                                {biomarker.reference_unit || biomarker.original_unit}
                                            </span>
                                        </div>
                                    )}

                                    {/* Confidence */}
                                    {biomarker.confidence && biomarker.confidence < 1.0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Confidence</span>
                                            <span className="text-sm text-gray-700">
                                                {Math.round(biomarker.confidence * 100)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Clinical Interpretation */}
                            {biomarker.interpretation && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                                        Clinical Interpretation
                                    </h3>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                            {biomarker.interpretation}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Disclaimer */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-xs text-gray-600">
                                    <strong>Disclaimer:</strong> This information is for educational purposes only
                                    and should not be used as a substitute for professional medical advice.
                                    Always consult with a qualified healthcare provider.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
