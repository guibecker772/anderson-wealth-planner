'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BookOpen, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import {
  buildPortalOnboardingStorageKey,
  portalOnboardingSteps,
  resolvePortalOnboardingUserKey,
  type PortalOnboardingState,
  type PortalOnboardingStatus,
  type PortalOnboardingStep,
} from '@/lib/portalOnboarding';

type PortalOnboardingProps = {
  enabled: boolean;
  openRequest: number;
};

type TourRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const TOUR_CARD_WIDTH = 360;

function isVisibleElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  );
}

function findTourTarget(targetId: string) {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(`[data-portal-tour="${targetId}"]`));
  return matches.find(isVisibleElement) ?? null;
}

function getTourCardPosition(step: PortalOnboardingStep, rect: TourRect | null) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 20;

  if (!rect || step.placement === 'center') {
    return {
      left: Math.max(margin, (viewportWidth - TOUR_CARD_WIDTH) / 2),
      top: Math.max(margin, (viewportHeight - 300) / 2),
    };
  }

  const positions = {
    right: {
      left: rect.left + rect.width + 20,
      top: rect.top + rect.height / 2 - 140,
    },
    left: {
      left: rect.left - TOUR_CARD_WIDTH - 20,
      top: rect.top + rect.height / 2 - 140,
    },
    top: {
      left: rect.left + rect.width / 2 - TOUR_CARD_WIDTH / 2,
      top: rect.top - 220,
    },
    bottom: {
      left: rect.left + rect.width / 2 - TOUR_CARD_WIDTH / 2,
      top: rect.top + rect.height + 20,
    },
    center: {
      left: Math.max(margin, (viewportWidth - TOUR_CARD_WIDTH) / 2),
      top: Math.max(margin, (viewportHeight - 300) / 2),
    },
  } as const;

  const preferred = positions[step.placement ?? 'bottom'];

  return {
    left: Math.min(Math.max(preferred.left, margin), viewportWidth - TOUR_CARD_WIDTH - margin),
    top: Math.min(Math.max(preferred.top, margin), viewportHeight - 280 - margin),
  };
}

export function PortalOnboarding({ enabled, openRequest }: PortalOnboardingProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [neverShowAgain, setNeverShowAgain] = useState(false);
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const initializedRef = useRef(false);
  const lastOpenRequestRef = useRef(0);

  const isInvestorPortalUser =
    sessionStatus === 'authenticated' &&
    session?.user?.role === 'INVESTOR' &&
    session?.user?.firstLogin !== true;

  const userKey = useMemo(
    () =>
      resolvePortalOnboardingUserKey({
        investorId: session?.user?.investorId,
        email: session?.user?.email,
        name: session?.user?.name,
      }),
    [session?.user?.email, session?.user?.investorId, session?.user?.name],
  );

  const storageKey = useMemo(() => buildPortalOnboardingStorageKey(userKey), [userKey]);
  const currentStep = portalOnboardingSteps[currentStepIndex] ?? null;

  function persistState(nextStatus: PortalOnboardingStatus) {
    if (typeof window === 'undefined') return;

    const nextState: PortalOnboardingState = {
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  }

  function openWelcomeModal() {
    setNeverShowAgain(false);
    setCurrentStepIndex(0);
    setTourOpen(false);
    setWelcomeOpen(true);
  }

  function closeWelcome(statusToSave: PortalOnboardingStatus) {
    persistState(neverShowAgain ? 'hidden' : statusToSave);
    setWelcomeOpen(false);
    setTourOpen(false);
  }

  function startTour() {
    setWelcomeOpen(false);
    setTourOpen(true);
    setCurrentStepIndex(0);
  }

  function closeTour(statusToSave: PortalOnboardingStatus) {
    persistState(statusToSave);
    setTourOpen(false);
    setCurrentStepIndex(0);
  }

  useEffect(() => {
    if (!enabled || !isInvestorPortalUser || initializedRef.current) return;

    initializedRef.current = true;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        openWelcomeModal();
      }
    } catch {
      openWelcomeModal();
    }
  }, [enabled, isInvestorPortalUser, storageKey]);

  useEffect(() => {
    if (!enabled || !isInvestorPortalUser) return;
    if (openRequest === 0 || openRequest === lastOpenRequestRef.current) return;

    lastOpenRequestRef.current = openRequest;
    openWelcomeModal();
  }, [enabled, isInvestorPortalUser, openRequest]);

  useEffect(() => {
    if (!tourOpen || !currentStep) {
      setTargetRect(null);
      return;
    }

    let frame = 0;

    const update = () => {
      const target = findTourTarget(currentStep.targetId);
      if (!target) {
        setTargetRect(null);
        return;
      }

      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [currentStep, tourOpen]);

  if (!enabled || !isInvestorPortalUser) {
    return null;
  }

  const cardPosition =
    typeof window !== 'undefined' && currentStep
      ? getTourCardPosition(currentStep, targetRect)
      : { left: 24, top: 24 };

  return (
    <>
      {welcomeOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-[560px] overflow-hidden rounded-[32px] border border-white/60 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#022D44,#0b4868,#A8CF4C)]" />
            <button
              type="button"
              onClick={() => closeWelcome('dismissed')}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
              aria-label="Fechar introdução do portal"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-7 sm:p-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#022D44]/8 text-[#022D44]">
                <Sparkles className="h-5 w-5" />
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#022D44]/50">
                  Primeiros passos
                </p>
                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#08283c]">
                  Boas-vindas ao Portal do Investidor
                </h2>
                <p className="text-sm leading-7 text-slate-600">
                  Aqui você acompanha a operação da carteira, consulta veículos e entende o impacto financeiro do período
                  com uma leitura simples e executiva.
                </p>
                <p className="text-sm leading-7 text-slate-600">
                  Se quiser, faço um tour rápido com os pontos principais do portal. Leva menos de um minuto.
                </p>
              </div>

              <label className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={neverShowAgain}
                  onChange={(event) => setNeverShowAgain(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#022D44] focus:ring-[#022D44]/20"
                />
                <span>Não mostrar esta introdução automaticamente novamente.</span>
              </label>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={startTour}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#022D44] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0a3b57]"
                >
                  <Sparkles className="h-4 w-4" />
                  Iniciar tour
                </button>

                <button
                  type="button"
                  onClick={() => closeWelcome('skipped')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Explorar agora
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tourOpen && currentStep ? (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" />

          {targetRect ? (
            <div
              className="pointer-events-none fixed rounded-[28px] border-2 border-[#A8CF4C] bg-white/6 shadow-[0_0_0_9999px_rgba(2,15,23,0.42),0_0_0_8px_rgba(255,255,255,0.08)] transition-all duration-200"
              style={{
                top: targetRect.top - 10,
                left: targetRect.left - 10,
                width: targetRect.width + 20,
                height: targetRect.height + 20,
              }}
            />
          ) : null}

          <div
            className="fixed z-[121] w-[min(360px,calc(100vw-32px))] rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.28)]"
            style={{ left: cardPosition.left, top: cardPosition.top }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#022D44]/8 text-[#022D44]">
                <BookOpen className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => closeTour('skipped')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                aria-label="Pular tour do portal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#022D44]/50">
                Passo {currentStepIndex + 1} de {portalOnboardingSteps.length}
              </p>
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#08283c]">
                {currentStep.title}
              </h3>
              <p className="text-sm leading-6 text-slate-600">
                {currentStep.description}
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2">
              {portalOnboardingSteps.map((step, index) => (
                <span
                  key={step.id}
                  className={`h-1.5 flex-1 rounded-full ${index === currentStepIndex ? 'bg-[#022D44]' : 'bg-slate-200'}`}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (currentStepIndex === 0) {
                    setTourOpen(false);
                    setWelcomeOpen(true);
                    return;
                  }

                  setCurrentStepIndex((index) => Math.max(0, index - 1));
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => closeTour('skipped')}
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
                >
                  Pular tour
                </button>

                {currentStepIndex === portalOnboardingSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => closeTour('completed')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#022D44] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a3b57]"
                  >
                    Concluir
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentStepIndex((index) => Math.min(portalOnboardingSteps.length - 1, index + 1))}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#022D44] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a3b57]"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Depois você pode rever esta introdução pelo botão <span className="font-semibold text-slate-700">Como usar o portal</span> no topo.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
