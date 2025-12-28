import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, helperText, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="mb-2 block text-sm font-medium text-text-muted">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        'flex h-11 w-full rounded-lg border border-surface bg-white/50 px-4 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
                        error && 'border-error ring-error/10 focus:border-error focus:ring-error/20',
                        className
                    )}
                    {...props}
                />
                {helperText && !error && (
                    <p className="mt-1.5 text-xs text-text-muted">{helperText}</p>
                )}
                {error && (
                    <p className="mt-1.5 text-xs font-medium text-error">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";
