'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatCurrency } from '@/lib/utils';

export function OverviewLineChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="period" />
        <YAxis tickFormatter={(val) => `R$ ${val/1000}k`} />
        <Tooltip formatter={(val: number) => formatCurrency(val)} />
        <Line type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={2} name="Receitas" />
        <Line type="monotone" dataKey="expense" stroke="#dc2626" strokeWidth={2} name="Despesas" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function OverviewBarChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis dataKey="category" type="category" width={100} tick={{fontSize: 12}} />
        <Tooltip formatter={(val: number) => formatCurrency(val)} />
        <Bar dataKey="_sum.actualAmount" fill="#64748b" radius={[0, 4, 4, 0]} name="Total" />
      </BarChart>
    </ResponsiveContainer>
  );
}