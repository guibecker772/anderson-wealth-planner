import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ShellNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
}

export interface ShellNavGroup {
  label: string;
  items: ShellNavItem[];
}

export interface ShellPageMeta {
  title: string;
  subtitle: string;
  workspaceLabel?: string;
}

export interface ShellBrandConfig {
  href: string;
  title: ReactNode;
  subtitle: string;
  icon: ReactNode;
}
