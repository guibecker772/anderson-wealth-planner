import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

/**
 * DELETE /api/admin/remove-seed
 * 
 * Removes the "Seed Data.xlsx" file and all its associated transactions from the database.
 * Also moves the file to an "archived" folder if it exists in LOCAL_IMPORT_FOLDER.
 */
export async function DELETE(_req: NextRequest) {
  // Check if database is configured
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  try {
    const { db } = await import('@/lib/db');

    // Find the seed file(s) - could match by name
    const seedFiles = await db.sourceFile.findMany({
      where: {
        name: 'Seed Data.xlsx',
      },
      select: {
        id: true,
        driveFileId: true,
        name: true,
      },
    });

    if (seedFiles.length === 0) {
      return NextResponse.json(
        { message: 'No seed file found', deleted: 0 },
        { status: 200 }
      );
    }

    // Use a transaction to safely delete all related data
    const result = await db.$transaction(async (tx) => {
      let totalTransactionsDeleted = 0;

      for (const seedFile of seedFiles) {
        // Count transactions before deletion
        const transactionCount = await tx.transaction.count({
          where: { sourceFileId: seedFile.id },
        });

        totalTransactionsDeleted += transactionCount;

        // Delete the source file (cascade will delete transactions due to onDelete: Cascade)
        await tx.sourceFile.delete({
          where: { id: seedFile.id },
        });
      }

      return {
        filesDeleted: seedFiles.length,
        transactionsDeleted: totalTransactionsDeleted,
      };
    });

    // Try to archive the physical file if it exists in LOCAL_IMPORT_FOLDER
    const localFolder = process.env.LOCAL_IMPORT_FOLDER;
    if (localFolder) {
      try {
        const processedPath = path.join(localFolder, 'processed', 'Seed Data.xlsx');
        const archivedFolder = path.join(localFolder, 'archived');
        
        if (fs.existsSync(processedPath)) {
          // Create archived folder if it doesn't exist
          if (!fs.existsSync(archivedFolder)) {
            fs.mkdirSync(archivedFolder, { recursive: true });
          }
          
          // Move file to archived
          const archivedPath = path.join(archivedFolder, `Seed Data.xlsx.${Date.now()}.archived`);
          fs.renameSync(processedPath, archivedPath);
        }
      } catch (fsError) {
        // Log but don't fail - the DB cleanup is the important part
        console.warn('Could not archive physical seed file:', fsError);
      }
    }

    return NextResponse.json({
      message: 'Seed data removed successfully',
      ...result,
    });
  } catch (error) {
    console.error('[api/admin/remove-seed] Error:', error);
    
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
