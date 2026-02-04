/**
 * Investor Analytics Service
 * 
 * Provides metrics for investors and their vehicles:
 * - List of investors (from config file)
 * - Per-investor consolidated metrics
 * - Per-vehicle breakdown (rental income, maintenance, fines)
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { dateRangeToDbFilter, type DateRangeStrings } from '@/lib/dateRange';
import {
  resolveAmount,
  extractPlate,
  isMaintenanceCategory,
  isFinesCategory,
  normalizeClassKey,
} from './metrics-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface Investor {
  id: string;
  name: string;
  vehicles: string[]; // List of plates
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface InvestorsConfig {
  investors: Investor[];
  _meta?: {
    description?: string;
    lastUpdated?: string;
    instructions?: string[];
  };
}

export interface InvestorVehicleMetrics {
  plate: string;
  status: string; // Vehicle status (placeholder for now)
  rentalIncome: number;
  maintenanceCost: number;
  finesCost: number;
  netResult: number;
}

export interface InvestorMetrics {
  investor: Investor;
  totals: {
    rentalIncome: number;
    maintenanceCost: number;
    finesCost: number;
    netResult: number;
  };
  vehicles: InvestorVehicleMetrics[];
  dateRange: DateRangeStrings;
}

export interface InvestorListResponse {
  investors: Investor[];
  total: number;
}

// ============================================================================
// INVESTOR DATA SOURCE
// ============================================================================

let cachedInvestors: Investor[] | null = null;

/**
 * Load investors from configuration file
 * 
 * Loads from data/investors.json if it exists, otherwise uses placeholder data
 */
export function loadInvestors(): Investor[] {
  // Return cache if available
  if (cachedInvestors) {
    return cachedInvestors;
  }
  
  try {
    // Try to load from JSON config file
    const configPath = path.join(process.cwd(), 'data', 'investors.json');
    
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const config: InvestorsConfig = JSON.parse(fileContent);
      
      if (config.investors && Array.isArray(config.investors)) {
        // Normalize vehicle plates to uppercase without hyphens
        cachedInvestors = config.investors.map(inv => ({
          ...inv,
          vehicles: inv.vehicles.map(v => v.toUpperCase().replace(/-/g, '')),
        }));
        
        console.log(`[investor-metrics] Loaded ${cachedInvestors.length} investors from config`);
        return cachedInvestors;
      }
    }
  } catch (error) {
    console.warn('[investor-metrics] Failed to load investors.json, using placeholder data:', error);
  }
  
  // Fallback to placeholder data
  cachedInvestors = [
    {
      id: 'inv-001',
      name: 'Investidor Exemplo 1',
      vehicles: ['ABC1234', 'DEF5678'],
    },
    {
      id: 'inv-002',
      name: 'Investidor Exemplo 2',
      vehicles: ['GHI9012', 'JKL3456'],
    },
  ];
  
  console.log('[investor-metrics] Using placeholder investor data');
  return cachedInvestors;
}

/**
 * Get single investor by ID
 */
export function getInvestorById(id: string): Investor | null {
  const investors = loadInvestors();
  return investors.find(inv => inv.id === id) || null;
}

/**
 * Get all investors
 */
export async function getInvestorList(): Promise<InvestorListResponse> {
  const investors = loadInvestors();
  return {
    investors,
    total: investors.length,
  };
}

// ============================================================================
// INVESTOR METRICS
// ============================================================================

/**
 * Get metrics for a specific investor
 */
export async function getInvestorMetrics(
  db: PrismaClient,
  investorId: string,
  dateRange: DateRangeStrings
): Promise<InvestorMetrics | null> {
  const investor = getInvestorById(investorId);
  if (!investor) return null;
  
  const dateFilter = dateRangeToDbFilter(dateRange);
  
  // Get all transactions in the period
  const transactions = await db.transaction.findMany({
    where: {
      dueDate: {
        gte: dateFilter.gte,
        lte: dateFilter.lte,
      },
    },
    select: {
      type: true,
      category: true,
      status: true,
      plannedAmount: true,
      actualAmount: true,
      grossAmount: true,
      description: true,
      rawJson: true,
    },
  });
  
  // Initialize vehicle metrics map
  const vehicleMetrics = new Map<string, InvestorVehicleMetrics>();
  for (const plate of investor.vehicles) {
    vehicleMetrics.set(plate.toUpperCase(), {
      plate: plate.toUpperCase(),
      status: 'Sem definição', // TODO: Implement vehicle status logic
      rentalIncome: 0,
      maintenanceCost: 0,
      finesCost: 0,
      netResult: 0,
    });
  }
  
  // Process transactions
  for (const tx of transactions) {
    const rawJson = tx.rawJson as Record<string, unknown> | null;
    const description = tx.description || (rawJson?.['Histórico'] as string) || (rawJson?.['Descrição'] as string) || '';
    const extractedPlate = extractPlate(description);
    
    // Check if this transaction belongs to one of the investor's vehicles
    let matchedPlate: string | null = null;
    if (extractedPlate) {
      const upperPlate = extractedPlate.toUpperCase();
      if (vehicleMetrics.has(upperPlate)) {
        matchedPlate = upperPlate;
      }
    }
    
    // Skip if transaction doesn't match any investor vehicle
    if (!matchedPlate) continue;
    
    const amount = resolveAmount({
      status: tx.status,
      actualAmount: tx.actualAmount ? Number(tx.actualAmount) : null,
      plannedAmount: tx.plannedAmount ? Number(tx.plannedAmount) : null,
      grossAmount: tx.grossAmount ? Number(tx.grossAmount) : null,
    });
    
    const metrics = vehicleMetrics.get(matchedPlate)!;
    const categoryKey = normalizeClassKey(tx.category);
    
    if (tx.type === 'RECEIVABLE') {
      // Check if it's rental income (LOCAÇÃO)
      if (categoryKey.includes('locacao') || categoryKey.includes('locação') || categoryKey.includes('aluguel')) {
        metrics.rentalIncome += amount;
      }
      // Other income types can be added here
    } else if (tx.type === 'PAYABLE') {
      if (isFinesCategory(tx.category)) {
        metrics.finesCost += amount;
      } else if (isMaintenanceCategory(tx.category)) {
        metrics.maintenanceCost += amount;
      }
      // Other expense types can be added here
    }
  }
  
  // Calculate net results and totals
  const totals = {
    rentalIncome: 0,
    maintenanceCost: 0,
    finesCost: 0,
    netResult: 0,
  };
  
  for (const metrics of Array.from(vehicleMetrics.values())) {
    metrics.netResult = metrics.rentalIncome - metrics.maintenanceCost - metrics.finesCost;
    totals.rentalIncome += metrics.rentalIncome;
    totals.maintenanceCost += metrics.maintenanceCost;
    totals.finesCost += metrics.finesCost;
  }
  
  totals.netResult = totals.rentalIncome - totals.maintenanceCost - totals.finesCost;
  
  return {
    investor,
    totals,
    vehicles: Array.from(vehicleMetrics.values()),
    dateRange,
  };
}

/**
 * Get summary metrics for all investors
 */
export async function getAllInvestorsMetrics(
  db: PrismaClient,
  dateRange: DateRangeStrings
): Promise<{ investors: (InvestorMetrics | null)[]; dateRange: DateRangeStrings }> {
  const investorList = loadInvestors();
  
  const metrics = await Promise.all(
    investorList.map(inv => getInvestorMetrics(db, inv.id, dateRange))
  );
  
  return {
    investors: metrics,
    dateRange,
  };
}
