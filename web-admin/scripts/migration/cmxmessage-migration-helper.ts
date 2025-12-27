/**
 * Migration Helper Script for cmxMessage
 * Scans codebase to identify files that need migration
 * 
 * Usage: npx ts-node scripts/migration/cmxmessage-migration-helper.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface MigrationTarget {
  file: string;
  line: number;
  content: string;
  type: 'window.alert' | 'window.confirm' | 'toast' | 'console.error' | 'console.log';
}

const results: MigrationTarget[] = [];

/**
 * Scan file for migration targets
 */
function scanFile(filePath: string): MigrationTarget[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const targets: MigrationTarget[] = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for window.alert
    if (line.includes('window.alert') && !line.includes('//')) {
      targets.push({
        file: filePath,
        line: lineNum,
        content: line.trim(),
        type: 'window.alert',
      });
    }
    
    // Check for window.confirm
    if (line.includes('window.confirm') && !line.includes('//')) {
      targets.push({
        file: filePath,
        line: lineNum,
        content: line.trim(),
        type: 'window.confirm',
      });
    }
    
    // Check for toast imports/usage
    if (
      (line.includes("from '@/lib/utils/toast'") || 
       line.includes('from "@/lib/utils/toast"') ||
       line.includes('toast.success') ||
       line.includes('toast.error') ||
       line.includes('toast.warning') ||
       line.includes('toast.info'))
      && !line.includes('//')
    ) {
      targets.push({
        file: filePath,
        line: lineNum,
        content: line.trim(),
        type: 'toast',
      });
    }
    
    // Check for console.error (user-facing)
    if (line.includes('console.error') && !line.includes('//')) {
      // Skip if it's a debug log or error boundary
      if (!line.includes('cmxMessage') && !line.includes('ErrorBoundary')) {
        targets.push({
          file: filePath,
          line: lineNum,
          content: line.trim(),
          type: 'console.error',
        });
      }
    }
    
    // Check for console.log (important operations)
    if (
      line.includes('console.log') && 
      !line.includes('//') &&
      (line.includes('saved') || 
       line.includes('created') || 
       line.includes('deleted') ||
       line.includes('updated') ||
       line.includes('export') ||
       line.includes('import'))
    ) {
      targets.push({
        file: filePath,
        line: lineNum,
        content: line.trim(),
        type: 'console.log',
      });
    }
  });

  return targets;
}

/**
 * Generate migration report
 */
function generateReport(targets: MigrationTarget[]): string {
  const byType = targets.reduce((acc, target) => {
    if (!acc[target.type]) {
      acc[target.type] = [];
    }
    acc[target.type].push(target);
    return acc;
  }, {} as Record<string, MigrationTarget[]>);

  const filesByType = Object.entries(byType).reduce((acc, [type, items]) => {
    const uniqueFiles = new Set(items.map((item) => item.file));
    acc[type] = uniqueFiles.size;
    return acc;
  }, {} as Record<string, number>);

  let report = '# cmxMessage Migration Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '## Summary\n\n';
  report += `Total migration targets: ${targets.length}\n\n`;
  
  report += '### By Type:\n';
  Object.entries(filesByType).forEach(([type, count]) => {
    report += `- ${type}: ${count} files\n`;
  });
  
  report += '\n## Details\n\n';
  
  Object.entries(byType).forEach(([type, items]) => {
    report += `### ${type}\n\n`;
    report += `Found ${items.length} instances in ${filesByType[type]} files\n\n`;
    
    // Group by file
    const byFile = items.reduce((acc, item) => {
      if (!acc[item.file]) {
        acc[item.file] = [];
      }
      acc[item.file].push(item);
      return acc;
    }, {} as Record<string, MigrationTarget[]>);
    
    Object.entries(byFile).forEach(([file, fileItems]) => {
      report += `#### ${file}\n`;
      fileItems.forEach((item) => {
        report += `- Line ${item.line}: \`${item.content.substring(0, 80)}${item.content.length > 80 ? '...' : ''}\`\n`;
      });
      report += '\n';
    });
  });
  
  return report;
}

/**
 * Main function
 */
async function main() {
  console.log('Scanning codebase for migration targets...\n');
  
  // Define patterns to scan
  const patterns = [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
  ];
  
  // Exclude patterns
  const exclude = [
    '**/node_modules/**',
    '**/.next/**',
    '**/__tests__/**',
    '**/coverage/**',
    '**/dist/**',
    '**/build/**',
  ];
  
  // Find all files
  const allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: exclude,
      cwd: process.cwd(),
    });
    allFiles.push(...files);
  }
  
  // Scan each file
  allFiles.forEach((file) => {
    try {
      const targets = scanFile(file);
      results.push(...targets);
    } catch (error) {
      console.error(`Error scanning ${file}:`, error);
    }
  });
  
  // Generate report
  const report = generateReport(results);
  
  // Write report to file
  const reportPath = path.join(process.cwd(), 'cmxmessage-migration-report.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  
  console.log(`\n✅ Scan complete! Found ${results.length} migration targets.`);
  console.log(`📄 Report saved to: ${reportPath}\n`);
  
  // Print summary
  const byType = results.reduce((acc, target) => {
    acc[target.type] = (acc[target.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Summary:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} instances`);
  });
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { scanFile, generateReport };

