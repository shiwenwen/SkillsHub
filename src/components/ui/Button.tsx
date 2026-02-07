import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
    variantType?: "default" | "outline" | "ghost" | "link"; // Helper to combine variant styles if needed, or just use variant
    size?: "xs" | "sm" | "md" | "lg";
    children: ReactNode;
    isLoading?: boolean;
    loading?: boolean; // Alias for isLoading to support legacy/my-bad code
}

export function Button({
    variant = "primary",
    size = "md",
    children,
    className = "",
    isLoading = false,
    loading, // Destructure loading alias
    disabled,
    ...props
}: ButtonProps) {
    const actualLoading = isLoading || loading || false;

    const variants = {
        primary: "btn-primary shadow-lg shadow-primary/20 text-primary-content hover:shadow-primary/40 border-none",
        secondary: "btn-secondary shadow-lg shadow-secondary/20 text-secondary-content hover:shadow-secondary/40 border-none",
        outline: "btn-outline border-base-content/20 text-base-content hover:bg-base-content/10 hover:border-base-content/30",
        ghost: "btn-ghost text-base-content/70 hover:text-base-content hover:bg-base-content/10",
        danger: "btn-error bg-error/10 text-error hover:bg-error/20 border-error/20 shadow-none",
        link: "btn-link text-primary no-underline hover:underline px-0",
    };

    const sizes = {
        xs: "btn-xs text-[10px] h-6 min-h-0 px-2",
        sm: "btn-sm text-xs",
        md: "btn-md text-sm",
        lg: "btn-lg text-base",
    };

    return (
        <button
            className={`btn rounded-xl font-medium transition-all duration-200 ${variants[variant] || variants.primary} ${sizes[size]} ${className}`}
            disabled={actualLoading || disabled}
            {...props}
        >
            {actualLoading && <span className="loading loading-spinner loading-xs"></span>}
            {children}
        </button>
    );
}
