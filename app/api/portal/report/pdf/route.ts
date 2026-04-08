import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host');

  if (host) {
    return `${forwardedProto ?? 'http'}://${host}`;
  }

  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, '');
  }

  return 'http://127.0.0.1:3000';
}

function buildPdfFilename(investorName: string, from: string, to: string): string {
  const investorSlug = slugify(investorName || 'investidor');
  return `relatorio-${investorSlug}-${from}-a-${to}.pdf`;
}

function getChromiumLaunchOptions() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

  return {
    headless: true,
    executablePath: executablePath || undefined,
    args: ['--disable-dev-shm-usage', '--font-render-hinting=medium'],
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const impersonateId = searchParams.get('_as');

  if (!from || !to) {
    return NextResponse.json({ error: 'Parâmetros from/to são obrigatórios' }, { status: 400 });
  }

  let investorId: string | null = null;

  if (user.role === 'INVESTOR') {
    investorId = user.investorId;
  } else if (user.role === 'ADMIN' && impersonateId) {
    investorId = impersonateId;
  }

  if (!investorId) {
    return NextResponse.json({ error: 'Escopo do investidor não definido' }, { status: 403 });
  }

  const investor = await db.investor.findUnique({
    where: { id: investorId },
    select: { displayName: true },
  });

  const investorName = investor?.displayName || user.investorName || user.name || 'Investidor';
  const filename = buildPdfFilename(investorName, from, to);
  const origin = buildOrigin(request);

  const reportUrl = new URL('/portal/relatorio', origin);
  reportUrl.searchParams.set('from', from);
  reportUrl.searchParams.set('to', to);
  if (user.role === 'ADMIN' && impersonateId) {
    reportUrl.searchParams.set('_as', impersonateId);
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch(getChromiumLaunchOptions());

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      ignoreHTTPSErrors: true,
    });

    await context.addCookies(
      request.cookies.getAll().map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        url: origin,
      })),
    );

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(45000);
    await page.emulateMedia({ media: 'print' });

    const response = await page.goto(reportUrl.toString(), {
      waitUntil: 'networkidle',
    });

    if (!response || !response.ok()) {
      return NextResponse.json(
        { error: 'Falha ao carregar a página do relatório para geração do PDF' },
        { status: 502 },
      );
    }

    await page.waitForFunction(() => document.documentElement.dataset.reportReady === 'true', undefined, {
      timeout: 45000,
    });

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });

    await context.close();

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[portal-report-pdf] generation failed', error);
    return NextResponse.json(
      { error: 'Não foi possível gerar o PDF do relatório no momento' },
      { status: 500 },
    );
  } finally {
    await browser.close();
  }
}
