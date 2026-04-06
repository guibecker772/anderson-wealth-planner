'use client';

import Link from 'next/link';
import { Printer } from 'lucide-react';

export function PortalReportActions({ backHref }: { backHref: string }) {
  return (
    <div className="portal-report-actions flex flex-wrap items-center justify-between gap-3">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        Voltar ao portal
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-xl bg-[#022D44] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#033956]"
      >
        <Printer className="h-4 w-4" />
        Imprimir / salvar em PDF
      </button>
    </div>
  );
}
