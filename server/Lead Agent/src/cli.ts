#!/usr/bin/env node
/**
 * cli.ts
 * Thin CLI wrapper over LeadFinderAPI and LeadFinderAgent.
 * Uses commander for commands and chalk for output.
 */
import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { LeadFinderAPI } from './api.js';
import { LeadFinderAgent } from './agent.js';
import { initDb } from './database/db.js';
import type { SearchFilters } from './models/business.js';

const program = new Command();
const api = new LeadFinderAPI();

program
  .name('lead-finder')
  .description('Lead Finder — local business discovery and enrichment for Veltro')
  .version('1.0.0');

// ─────────────────────────────────────────────
// init
// ─────────────────────────────────────────────

program
  .command('init')
  .description('Initialise the database')
  .action(() => {
    initDb();
    console.log(chalk.green('✅ Database initialised.'));
  });

// ─────────────────────────────────────────────
// search
// ─────────────────────────────────────────────

program
  .command('search <query>')
  .description('Scrape Google Maps and optionally enrich with emails')
  .option('-n, --max-results <n>', 'Max results to scrape', '50')
  .option('--min-rating <n>', 'Minimum star rating', '4.0')
  .option('--min-reviews <n>', 'Minimum review count', '5')
  .option('--no-enrich', 'Skip email enrichment')
  .action(async (query: string, opts) => {
    const spinner = ora(`Searching for: ${chalk.bold(query)}`).start();

    try {
      const filters: Partial<SearchFilters> = {
        minRating: parseFloat(opts.minRating),
        minReviews: parseInt(opts.minReviews, 10),
      };

      const result = await api.search({
        query,
        maxResults: parseInt(opts.maxResults, 10),
        filters,
        enrich: opts.enrich !== false,
      });

      spinner.succeed('Search complete');
      const { summary } = result;

      console.log('');
      console.log(`  ${chalk.dim('Scraped:        ')} ${summary.totalScraped}`);
      console.log(`  ${chalk.dim('Passed filters: ')} ${summary.passedFilters}`);
      console.log(`  ${chalk.dim('Emails found:   ')} ${chalk.green(String(summary.emailsFound))}`);
      console.log(`  ${chalk.dim('High quality:   ')} ${chalk.cyan(String(summary.highQuality))} ${chalk.dim('(score ≥ 0.7)')}`);
      console.log(`  ${chalk.dim('PECR eligible:  ')} ${summary.pecrEligible}`);
      console.log(`  ${chalk.dim('Runtime:        ')} ${summary.runtimeSeconds}s`);
      console.log('');
      console.log(`  ${chalk.yellow('💡')} ${summary.recommendation}`);
    } catch (err) {
      spinner.fail('Search failed');
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// enrich
// ─────────────────────────────────────────────

program
  .command('enrich')
  .description('Enrich unenriched businesses with email addresses')
  .option('-b, --batch-size <n>', 'Concurrent requests per batch', '10')
  .option('-d, --delay <ms>', 'Milliseconds between batches', '2000')
  .option('-l, --limit <n>', 'Max records to enrich', '100')
  .action(async (opts) => {
    const spinner = ora('Enriching leads...').start();

    try {
      const result = await api.enrich({
        batchSize: parseInt(opts.batchSize, 10),
        delay: parseInt(opts.delay, 10),
        limit: parseInt(opts.limit, 10),
      });

      spinner.succeed(`Enriched ${chalk.green(String(result.enrichedCount))} businesses`);
      console.log(`  ${chalk.dim('Emails found:   ')} ${chalk.green(String(result.emailsFound))}`);
      console.log(`  ${chalk.dim('PECR eligible:  ')} ${result.pecrEligible}`);
    } catch (err) {
      spinner.fail('Enrichment failed');
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// export
// ─────────────────────────────────────────────

program
  .command('export')
  .description('Export quality leads to CSV')
  .option('-o, --output <path>', 'Output file path', 'leads.csv')
  .option('--min-rating <n>', 'Minimum star rating', '4.0')
  .option('--min-reviews <n>', 'Minimum review count', '5')
  .option('--min-score <n>', 'Minimum lead score (0–1)', '0')
  .option('--all', 'Include leads without email')
  .action(async (opts) => {
    const spinner = ora('Exporting leads...').start();

    try {
      const filters: Partial<SearchFilters> = {
        minRating: parseFloat(opts.minRating),
        minReviews: parseInt(opts.minReviews, 10),
        requireEmail: !opts.all,
      };

      const result = await api.export({
        filters,
        outputPath: opts.output,
        minLeadScore: parseFloat(opts.minScore),
      });

      spinner.succeed(
        `Exported ${chalk.green(String(result.exported))} leads to ${chalk.cyan(result.outputPath)}`
      );

      if (result.topLeads.length > 0) {
        console.log('');
        const rows = [
          [
            chalk.bold('Name'),
            chalk.bold('Email'),
            chalk.bold('Rating'),
            chalk.bold('Score'),
            chalk.bold('PECR'),
          ],
          ...result.topLeads.map((l) => [
            l.name,
            l.email ?? chalk.dim('—'),
            String(l.rating ?? '—'),
            String(l.leadScore ?? '—'),
            l.pecrStatus,
          ]),
        ];
        console.log(table(rows));
      }
    } catch (err) {
      spinner.fail('Export failed');
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// status
// ─────────────────────────────────────────────

program
  .command('status')
  .description('Show database statistics')
  .option('-q, --query <query>', 'Filter to a specific search run')
  .action(async (opts) => {
    try {
      const stats = await api.status(opts.query);
      console.log('');
      console.log(chalk.bold('Lead Finder Status'));
      console.log(`  ${chalk.dim('Total records:  ')} ${stats.total}`);
      console.log(`  ${chalk.dim('Enriched:       ')} ${stats.enriched}`);
      console.log(`  ${chalk.dim('Emails found:   ')} ${chalk.green(String(stats.emailsFound))}`);
      console.log(`  ${chalk.dim('High quality:   ')} ${chalk.cyan(String(stats.highQuality))} ${chalk.dim('(score ≥ 0.7)')}`);
      console.log(`  ${chalk.dim('PECR eligible:  ')} ${stats.pecrEligible}`);
      console.log('');
    } catch (err) {
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// agent
// ─────────────────────────────────────────────

program
  .command('agent <instruction>')
  .description('Run the Lead Finder Agent with a natural language instruction')
  .action(async (instruction: string) => {
    const spinner = ora('Agent running...').start();

    try {
      const agent = new LeadFinderAgent();
      const result = await agent.run(instruction);
      spinner.stop();
      console.log('');
      console.log(chalk.bold.green('Lead Finder Agent'));
      console.log(result.agentResponse);
    } catch (err) {
      spinner.fail('Agent run failed');
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// strategy
// ─────────────────────────────────────────────

program
  .command('strategy')
  .description('Run the Strategy Agent to analyze high-quality leads')
  .option('-l, --limit <n>', 'Max records to analyze', '10')
  .option('-m, --model <name>', 'Ollama model to use', process.env['DEFAULT_MODEL'] || 'ollama/llama3')
  .action(async (opts) => {
    const spinner = ora('Strategy Agent thinking...').start();

    try {
      const { StrategyAgent } = await import('./strategyAgent.js');
      const agent = new StrategyAgent(opts.model);
      const result = await agent.processLeads(parseInt(opts.limit, 10));

      spinner.succeed(`Strategy Agent complete. Analyzed ${chalk.green(String(result))} leads.`);
      console.log(chalk.dim('\n  Check your leads for "strategyAnalysis" and "strategyEmail" fields.'));
    } catch (err) {
      spinner.fail('Strategy Agent failed');
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });

program.parse();
