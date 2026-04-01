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
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm backdrop-blur-sm",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: 
          "text-foreground border-border",
        
        success: 
          "border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400",
        warning: 
          "border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400",
        error: 
          "border-red-200/70 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400",
        info: 
          "border-sky-200/70 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-400",
        neutral: 
          "border-gray-200/70 bg-gray-50 text-gray-700 dark:border-gray-500/30 dark:bg-gray-500/15 dark:text-gray-400",
        
        accent:
          "border-[#A8CF4C]/30 bg-[#A8CF4C]/12 text-[#425d14] dark:border-[#A8CF4C]/30 dark:bg-[#A8CF4C]/15 dark:text-[#A8CF4C]",
      },
      size: {
        default: "px-2.5 py-0.5 text-[11px]",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-xs",
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
