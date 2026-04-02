'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/lib/components/layout/ui/button';

export function RemoveSeedButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRemove = async () => {
    if (!confirm('Tem certeza que deseja remover o arquivo "Seed Data.xlsx" e todas as suas transações associadas?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/remove-seed', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao remover seed data');
      }

      setSuccess(true);
      // Refresh the page to update the list
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <span className="text-green-600 text-sm font-medium">
        ✓ Removido com sucesso!
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-red-600 text-xs">{error}</span>}
      <Button
        variant="destructive"
        size="sm"
        onClick={handleRemove}
        disabled={loading}
        className="gap-1"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
        Remover Seed
      </Button>
    </div>
  );
}
