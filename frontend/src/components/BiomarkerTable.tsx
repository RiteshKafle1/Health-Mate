import { useState } from 'react';
import {
    ChevronUp, ChevronDown, ChevronRight, ArrowUpDown
} from 'lucide-react';
import type { ExtractedValue, ValueStatus } from '../api/labInterpret';
import { getStatusColor, getStatusLabel } from '../api/labInterpret';
import { BiomarkerDetailModal } from './BiomarkerDetailModal';

interface BiomarkerTableProps {
    values: ExtractedValue[];
}

type SortField = 'name' | 'status' | 'value';
type SortDirection = 'asc' | 'desc';

// Status priority for sorting (critical first)
const statusPriority: Record<ValueStatus, number> = {
    critical_high: 1,
    critical_low: 2,
    high: 3,
    low: 4,
    unknown: 5,
    normal: 6,
};

export function BiomarkerTable({ values }: BiomarkerTableProps) {
    const [sortField, setSortField] = useState<SortField>('status');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [selectedBiomarker, setSelectedBiomarker] = useState<ExtractedValue | null>(null);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedValues = [...values].sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
            case 'name':
                comparison = a.biomarker_name.localeCompare(b.biomarker_name);
                break;
            case 'status':
                comparison = statusPriority[a.status] - statusPriority[b.status];
                break;
            case 'value':
                comparison = a.original_value - b.original_value;
                break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
    });

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ArrowUpDown size={14} className="text-[#2D336B]/30" />;
        }
        return sortDirection === 'asc'
            ? <ChevronUp size={14} className="text-[#7886C7]" />
            : <ChevronDown size={14} className="text-[#7886C7]" />;
    };

    const getStatusBadge = (status: ValueStatus) => {
        const colorClass = getStatusColor(status);
        const label = getStatusLabel(status);
        return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
                {label}
            </span>
        );
    };

    return (
        <>
            <div className="overflow-hidden rounded-xl border border-[#A9B5DF]/30">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#A9B5DF]/10">
                            <th
                                onClick={() => handleSort('name')}
                                className="px-4 py-3 text-left text-sm font-bold text-[#2D336B] cursor-pointer hover:bg-[#A9B5DF]/20 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    Biomarker
                                    <SortIcon field="name" />
                                </div>
                            </th>
                            <th
                                onClick={() => handleSort('value')}
                                className="px-4 py-3 text-left text-sm font-bold text-[#2D336B] cursor-pointer hover:bg-[#A9B5DF]/20 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    Value
                                    <SortIcon field="value" />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-[#2D336B]">
                                Reference Range
                            </th>
                            <th
                                onClick={() => handleSort('status')}
                                className="px-4 py-3 text-left text-sm font-bold text-[#2D336B] cursor-pointer hover:bg-[#A9B5DF]/20 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    Status
                                    <SortIcon field="status" />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-[#2D336B] print:hidden">
                                <span className="sr-only">Details</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#A9B5DF]/20">
                        {sortedValues.map((value, index) => {
                            const isCritical = value.status.startsWith('critical');

                            return (
                                <tr
                                    key={`${value.biomarker_name}-${index}`}
                                    onClick={() => setSelectedBiomarker(value)}
                                    className={`group hover:bg-[#FFF2F2]/50 transition-colors cursor-pointer ${isCritical ? 'bg-red-50/50' : ''}`}
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-[#2D336B]">
                                            {value.biomarker_name}
                                        </div>
                                        {value.matched_id && value.matched_id !== value.biomarker_name.toLowerCase().replace(/ /g, '_') && (
                                            <div className="text-xs text-[#2D336B]/50 mt-0.5">
                                                ID: {value.matched_id}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-[#2D336B]">
                                            {value.original_value} {value.original_unit}
                                        </div>
                                        {value.converted_value && value.reference_unit && (
                                            <div className="text-xs text-[#7886C7] mt-0.5">
                                                ≈ {value.converted_value} {value.reference_unit}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-[#2D336B]/70">
                                        {value.reference_range || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {getStatusBadge(value.status)}
                                    </td>
                                    <td className="px-4 py-3 print:hidden">
                                        <ChevronRight size={16} className="text-[#7886C7] group-hover:translate-x-1 transition-transform" />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {sortedValues.length === 0 && (
                    <div className="p-8 text-center text-[#2D336B]/50">
                        No biomarker values extracted
                    </div>
                )}
            </div>

            {/* Biomarker Detail Modal */}
            <BiomarkerDetailModal
                biomarker={selectedBiomarker}
                isOpen={selectedBiomarker !== null}
                onClose={() => setSelectedBiomarker(null)}
            />
        </>
    );
}
