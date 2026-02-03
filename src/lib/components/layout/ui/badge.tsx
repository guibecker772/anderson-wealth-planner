import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Badge Component - ClikFinance Design System
 * 
 * Variantes semânticas:
 * - success: Quitado, Processado, Ativo
 * - warning: Pendente, Aguardando
 * - error: Vencido, Erro, Falha
 * - info: Agendado, Processando
 * - neutral: Cancelado, Desconhecido
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Semantic variants
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: 
          "text-foreground border-border",
        
        // Status-specific variants (ClikFinance palette)
        success: 
          "border-transparent bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
        warning: 
          "border-transparent bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
        error: 
          "border-transparent bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400",
        info: 
          "border-transparent bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
        neutral: 
          "border-transparent bg-gray-500/15 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
        
        // ClikFinance accent
        accent:
          "border-transparent bg-[#A8CF4C]/15 text-[#5a7a1a] dark:bg-[#A8CF4C]/20 dark:text-[#A8CF4C]",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }