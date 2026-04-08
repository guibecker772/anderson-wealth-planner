'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FleetVehicleRow } from '@/lib/analytics/fleet-metrics';

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getQualityLabel(warning: number, reviewRequired: number) {
  const total = warning + reviewRequired;
  if (reviewRequired > 0) return `${total} revisão(ões)`;
  if (warning > 0) return `${total} alerta(s)`;
  return 'OK';
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
      {status}
    </span>
  );
}

function QualityPill({
  warning,
  reviewRequired,
  label,
}: {
  warning: number;
  reviewRequired: number;
  label: string;
}) {
  const toneClass =
    reviewRequired > 0
      ? 'border-red-200 bg-red-50 text-red-700'
      : warning > 0
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>{label}</span>;
}

function AnnexPageHeader({
  title,
  accent,
  meta,
}: {
  title: string;
  accent: string;
  meta: string;
}) {
  return (
    <div className="report-page-header border-b border-slate-200/80 pb-4">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <h2 className="text-[1.75rem] font-semibold tracking-tight text-slate-900">{accent}</h2>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>Período de referência</p>
          <p className="mt-1 font-medium text-slate-800">{meta}</p>
        </div>
      </div>
    </div>
  );
}

function AnnexFooter({ brand, meta }: { brand: string; meta: string }) {
  return (
    <div className="report-footer flex items-center justify-between border-t border-slate-200/70 pt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
      <span>{brand}</span>
      <span>{meta}</span>
    </div>
  );
}

function AnnexTable({
  vehicles,
  rowRefs,
}: {
  vehicles: FleetVehicleRow[];
  rowRefs?: { current: (HTMLTableRowElement | null)[] };
}) {
  return (
    <table className="report-table portal-report-table report-annex-table w-full table-fixed text-sm">
      <colgroup>
        <col className="w-[9%]" />
        <col className="w-[21%]" />
        <col className="w-[13%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[9%]" />
      </colgroup>
      <thead>
        <tr>
          <th className="px-4 py-3 text-left">Placa</th>
          <th className="px-4 py-3 text-left">Modelo</th>
          <th className="px-4 py-3 text-left">Status</th>
          <th className="px-4 py-3 text-right">Recebido</th>
          <th className="px-4 py-3 text-right">Custos</th>
          <th className="px-4 py-3 text-right">A cobrar</th>
          <th className="px-4 py-3 text-right">Resultado</th>
          <th className="px-4 py-3 text-left">Qualidade</th>
        </tr>
      </thead>
      <tbody>
        {vehicles.map((vehicle, index) => (
          <tr key={vehicle.plate} ref={rowRefs ? (node) => { rowRefs.current[index] = node; } : undefined}>
            <td className="px-4 py-3 font-mono font-semibold text-[#0f2439]">{vehicle.plate}</td>
            <td className="px-4 py-3 text-slate-700">{vehicle.model || 'Modelo não identificado'}</td>
            <td className="px-4 py-3">
              <StatusPill status={vehicle.currentStatus} />
            </td>
            <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrencyFull(vehicle.revenueReceived)}</td>
            <td className="px-4 py-3 text-right font-medium text-red-700">{formatCurrencyFull(vehicle.operationalCost)}</td>
            <td className="px-4 py-3 text-right font-medium text-amber-700">{formatCurrencyFull(vehicle.amountToCharge)}</td>
            <td className={`px-4 py-3 text-right font-semibold ${vehicle.operationalResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrencyFull(vehicle.operationalResult)}
            </td>
            <td className="px-4 py-3">
              <QualityPill
                warning={vehicle.qualitySummary.WARNING}
                reviewRequired={vehicle.qualitySummary.REVIEW_REQUIRED}
                label={getQualityLabel(vehicle.qualitySummary.WARNING, vehicle.qualitySummary.REVIEW_REQUIRED)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PortalReportAnnex({
  vehicles,
  periodLabel,
  investorName,
}: {
  vehicles: FleetVehicleRow[];
  periodLabel: string;
  investorName: string;
}) {
  const [pages, setPages] = useState<FleetVehicleRow[][]>([vehicles]);
  const measureShellRef = useRef<HTMLDivElement | null>(null);
  const measureHeaderRef = useRef<HTMLDivElement | null>(null);
  const measureWrapRef = useRef<HTMLDivElement | null>(null);
  const measureBodyRef = useRef<HTMLTableSectionElement | null>(null);
  const measureFooterRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  useLayoutEffect(() => {
    document.documentElement.dataset.reportReady = 'false';

    const shell = measureShellRef.current;
    const header = measureHeaderRef.current;
    const wrap = measureWrapRef.current;
    const body = measureBodyRef.current;
    const footer = measureFooterRef.current;

    if (!shell || !header || !wrap || !body || !footer) {
      document.documentElement.dataset.reportReady = 'true';
      return;
    }

    const shellHeight = shell.getBoundingClientRect().height;
    const headerHeight = header.getBoundingClientRect().height;
    const footerHeight = footer.getBoundingClientRect().height;
    const wrapHeight = wrap.getBoundingClientRect().height;
    const bodyHeight = body.getBoundingClientRect().height;
    const fixedTableHeight = wrapHeight - bodyHeight;
    // Subtract flex gaps between 3 children (2 × 10px) + safety for sub-pixel rounding
    const availableBodyHeight = Math.max(shellHeight - headerHeight - footerHeight - fixedTableHeight - 24, 0);

    const computedPages: FleetVehicleRow[][] = [];
    let currentPage: FleetVehicleRow[] = [];
    let currentHeight = 0;

    vehicles.forEach((vehicle, index) => {
      const rowHeight = rowRefs.current[index]?.getBoundingClientRect().height ?? 0;
      const nextHeight = currentHeight + rowHeight;

      if (currentPage.length > 0 && nextHeight > availableBodyHeight) {
        computedPages.push(currentPage);
        currentPage = [vehicle];
        currentHeight = rowHeight;
      } else {
        currentPage.push(vehicle);
        currentHeight = nextHeight;
      }
    });

    if (currentPage.length > 0) {
      computedPages.push(currentPage);
    }

    setPages(computedPages.length > 0 ? computedPages : [[]]);
    requestAnimationFrame(() => {
      document.documentElement.dataset.reportReady = 'true';
    });
  }, [vehicles]);

  const pageCount = useMemo(() => pages.length, [pages]);

  return (
    <>
      <div className="report-annex-measure" aria-hidden="true">
        <div ref={measureShellRef} className="report-annex-measure-shell report-page-shell report-annex-shell">
          <div ref={measureHeaderRef}>
            <AnnexPageHeader title="Anexo Analítico da Carteira" accent={`${vehicles.length} veículo(s) detalhados no período`} meta={periodLabel} />
          </div>
          <div ref={measureWrapRef} className="report-annex-table-wrap overflow-hidden rounded-[20px] border border-slate-300/80">
            <table className="report-table portal-report-table report-annex-table w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[21%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[9%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left">Placa</th>
                  <th className="px-4 py-3 text-left">Modelo</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Recebido</th>
                  <th className="px-4 py-3 text-right">Custos</th>
                  <th className="px-4 py-3 text-right">A cobrar</th>
                  <th className="px-4 py-3 text-right">Resultado</th>
                  <th className="px-4 py-3 text-left">Qualidade</th>
                </tr>
              </thead>
              <tbody ref={measureBodyRef}>
                {vehicles.map((vehicle, index) => (
                  <tr key={`measure-${vehicle.plate}`} ref={(node) => { rowRefs.current[index] = node; }}>
                    <td className="px-4 py-3 font-mono font-semibold text-[#0f2439]">{vehicle.plate}</td>
                    <td className="px-4 py-3 text-slate-700">{vehicle.model || 'Modelo não identificado'}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={vehicle.currentStatus} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrencyFull(vehicle.revenueReceived)}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-700">{formatCurrencyFull(vehicle.operationalCost)}</td>
                    <td className="px-4 py-3 text-right font-medium text-amber-700">{formatCurrencyFull(vehicle.amountToCharge)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${vehicle.operationalResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatCurrencyFull(vehicle.operationalResult)}
                    </td>
                    <td className="px-4 py-3">
                      <QualityPill
                        warning={vehicle.qualitySummary.WARNING}
                        reviewRequired={vehicle.qualitySummary.REVIEW_REQUIRED}
                        label={getQualityLabel(vehicle.qualitySummary.WARNING, vehicle.qualitySummary.REVIEW_REQUIRED)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div ref={measureFooterRef}>
            <AnnexFooter brand="Anexo analítico" meta={investorName} />
          </div>
        </div>
      </div>

      {pages.map((pageVehicles, pageIndex) => (
        <section
          key={`annex-page-${pageIndex + 1}`}
          className="report-page--landscape report-annex overflow-hidden rounded-[34px] border border-slate-200/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.08)]"
        >
          <div className="report-page-shell report-annex-shell">
            <AnnexPageHeader
              title={pageIndex === 0 ? 'Anexo Analítico da Carteira' : 'Anexo Analítico da Carteira — continuação'}
              meta={periodLabel}
              accent={
                pageIndex === 0
                  ? `${vehicles.length} veículo(s) detalhados no período`
                  : `Folha ${pageIndex + 1} de ${pageCount} do anexo`
              }
            />

            <div className="report-annex-table-wrap overflow-hidden rounded-[20px] border border-slate-300/80">
              <AnnexTable vehicles={pageVehicles} />
            </div>

            <AnnexFooter brand={`Anexo analítico — folha ${pageIndex + 1}/${pageCount}`} meta={investorName} />
          </div>
        </section>
      ))}
    </>
  );
}
