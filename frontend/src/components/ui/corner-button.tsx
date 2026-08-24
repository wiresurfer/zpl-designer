import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface CornerButtonProps {
    position: CornerPosition;
    variant?: 'default' | 'outline';
    onClick?: () => void;
    children: React.ReactNode;
}

const positionClasses: Record<CornerPosition, string> = {
    'top-left': 'top-0 left-0 rounded-tl-xl',
    'top-right': 'top-0 right-0 rounded-tr-xl',
    'bottom-left': 'bottom-0 left-0 rounded-bl-xl',
    'bottom-right': 'bottom-0 right-0 rounded-br-xl'
};

export function CornerButton({ 
    position, 
    variant = 'default',
    onClick,
    children 
}: CornerButtonProps) {
    return (
        <Button 
            variant={variant}
            className={cn(
                "absolute h-24 w-24 font-mono",
                positionClasses[position],
                variant === 'outline' ? "bg-white hover:bg-gray-100" : "bg-black hover:bg-black/90 text-white"
            )}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}
