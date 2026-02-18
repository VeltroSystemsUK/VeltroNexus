/**
 * performanceMonitor.ts
 * Tracks daily/weekly performance metrics and generates reports
 */

import { getRunStats } from './database/db.js';
import { getTotalDailyTarget, NICHES } from './config/niches.js';

export interface DailyMetrics {
    date: string;
    totalLeads: number;
    enriched: number;
    emailsFound: number;
    highQuality: number;
    migrated: number;
    target: number;
    achievementRate: number; // percentage
    nicheBreakdown: Record<string, {
        leads: number;
        target: number;
        highQuality: number;
    }>;
}

export interface WeeklyReport {
    weekStart: string;
    weekEnd: string;
    totalLeads: number;
    dailyAverage: number;
    weeklyTarget: number;
    achievementRate: number;
    topNiches: Array<{ niche: string; leads: number }>;
    topLeads: Array<{
        name: string;
        niche: string;
        leadScore: number;
        email: string | null;
    }>;
}

/**
 * Calculate daily metrics
 */
export function getDailyMetrics(date?: Date): DailyMetrics {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Get overall stats
    const stats = getRunStats();

    // Calculate metrics
    const target = getTotalDailyTarget();
    const achievementRate = (stats.total / target) * 100;

    // Niche breakdown (would need to query by niche - simplified here)
    const nicheBreakdown: DailyMetrics['nicheBreakdown'] = {};
    NICHES.forEach((niche) => {
        nicheBreakdown[niche.id] = {
            leads: 0, // TODO: Calculate from DB by search query pattern
            target: niche.dailyTarget,
            highQuality: 0,
        };
    });

    return {
        date: dateStr,
        totalLeads: stats.total,
        enriched: stats.enriched,
        emailsFound: stats.emailsFound,
        highQuality: stats.highQuality,
        migrated: 0, // TODO: Get from migrated count
        target,
        achievementRate,
        nicheBreakdown,
    };
}

/**
 * Generate weekly report
 */
export function getWeeklyReport(): WeeklyReport {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4); // Friday

    const stats = getRunStats();
    const weeklyTarget = getTotalDailyTarget() * 5; // 5 working days
    const achievementRate = (stats.total / weeklyTarget) * 100;

    return {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        totalLeads: stats.total,
        dailyAverage: stats.total / 5,
        weeklyTarget,
        achievementRate,
        topNiches: [], // TODO: Calculate from DB
        topLeads: [], // TODO: Get highest scoring leads
    };
}

/**
 * Log daily summary to console
 */
export function logDailySummary(metrics: DailyMetrics): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DAILY PERFORMANCE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Date: ${metrics.date}`);
    console.log(`Target: ${metrics.target} leads`);
    console.log(`Actual: ${metrics.totalLeads} leads (${metrics.achievementRate.toFixed(1)}%)`);
    console.log(`Enriched: ${metrics.enriched}`);
    console.log(`Emails Found: ${metrics.emailsFound}`);
    console.log(`High Quality: ${metrics.highQuality}`);
    console.log(`Migrated to CRM: ${metrics.migrated}`);

    if (metrics.achievementRate >= 100) {
        console.log('✅ TARGET ACHIEVED!');
    } else if (metrics.achievementRate >= 80) {
        console.log('⚠️  Close to target - slight shortfall');
    } else {
        console.log('❌ Target missed - review strategy');
    }

    console.log('='.repeat(60) + '\n');
}

/**
 * Log weekly report
 */
export function logWeeklyReport(report: WeeklyReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📈 WEEKLY PERFORMANCE REPORT');
    console.log('='.repeat(60));
    console.log(`Week: ${report.weekStart} to ${report.weekEnd}`);
    console.log(`Weekly Target: ${report.weeklyTarget} leads`);
    console.log(`Total Leads: ${report.totalLeads} (${report.achievementRate.toFixed(1)}%)`);
    console.log(`Daily Average: ${report.dailyAverage.toFixed(0)} leads/day`);

    if (report.achievementRate >= 100) {
        console.log('🎉 WEEKLY BENCHMARK ACHIEVED!');
    } else {
        console.log(`⚠️  Weekly target missed by ${(report.weeklyTarget - report.totalLeads).toFixed(0)} leads`);
    }

    console.log('='.repeat(60) + '\n');
}
