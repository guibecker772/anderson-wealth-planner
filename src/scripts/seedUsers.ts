/**
 * Seed users: creates an admin user and one investor user for each existing Investor.
 *
 * Usage:
 *   npx tsx src/scripts/seedUsers.ts
 *
 * Default admin credentials: admin@clikfinance.com / admin123
 * Default investor credentials: <normalized-name>@investidor.clikfinance.com / investidor123
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('🔐 Seeding users...\n');

  const ADMIN_EMAIL = 'admin@clikfinance.com';
  const ADMIN_PASSWORD = 'admin123';
  const INVESTOR_PASSWORD = 'investidor123';

  // 1. Create admin user
  const adminHash = await hash(ADMIN_PASSWORD, 12);
  const admin = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: adminHash, name: 'Administrador', role: 'ADMIN', active: true },
    create: { email: ADMIN_EMAIL, passwordHash: adminHash, name: 'Administrador', role: 'ADMIN', active: true },
  });
  console.log(`✅ Admin: ${admin.email} (role: ${admin.role})`);

  // 2. Create one investor user per existing Investor
  const investors = await db.investor.findMany({ orderBy: { displayName: 'asc' } });

  for (const inv of investors) {
    const slug = inv.normalizedName
      .toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '');
    const email = `${slug}@investidor.clikfinance.com`;
    const passwordHash = await hash(INVESTOR_PASSWORD, 12);

    const user = await db.user.upsert({
      where: { email },
      update: { passwordHash, name: inv.displayName, role: 'INVESTOR', investorId: inv.id, active: true },
      create: { email, passwordHash, name: inv.displayName, role: 'INVESTOR', investorId: inv.id, active: true },
    });
    console.log(`✅ Investidor: ${user.email} → ${inv.displayName} (investorId: ${inv.id})`);
  }

  console.log(`\n📋 Total: 1 admin + ${investors.length} investidores`);
  console.log(`\n🔑 Credenciais padrão:`);
  console.log(`   Admin:      ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`   Investidor: <email acima> / ${INVESTOR_PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
