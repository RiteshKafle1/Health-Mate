import { type ReactNode } from 'react';
import { Check } from 'lucide-react';

interface OptionChipProps {
    label: string;
    onClick: () => void;
    selected?: boolean;
    icon?: ReactNode;
    disabled?: boolean;
}

export function OptionChip({ label, onClick, selected = false, icon, disabled = false }: OptionChipProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                relative flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium
                transition-all duration-200 ease-out border shadow-sm
                ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}
                ${selected
                    ? 'bg-purple-50 text-purple-700 border-purple-500 ring-1 ring-purple-500 shadow-purple-500/10'
                    : 'bg-white text-text-muted border-surface hover:border-purple-300 hover:text-purple-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
                }
            `}
        >
            {icon && <span className="text-lg">{icon}</span>}
            <span className="flex-1 text-left">{label}</span>
            {selected && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                </span>
            )}
        </button>
    );
}
