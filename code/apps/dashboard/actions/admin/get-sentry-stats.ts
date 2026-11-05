// Showcase note: the admin dashboard's system health card reads issue counts from the Sentry
// API, so the hosts see error volume next to signups and revenue.

'use server';

import { auth } from '@workspace/auth';
import { keys } from '@workspace/monitoring/keys';

import { isSuperAdmin } from '~/lib/admin-utils';

export interface SentryIssue {
  id: string;
  title: string;
  shortId: string;
  level: 'error' | 'warning' | 'info' | 'fatal';
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  isUnhandled: boolean;
}

export interface SentryStats {
  // Error metrics
  errors: {
    total24h: number;
    total7d: number;
    trend: 'up' | 'down' | 'stable';
    trendPercent: number;
  };
  // Unhandled errors (crashes)
  unhandled: {
    total24h: number;
    total7d: number;
  };
  // Recent issues
  recentIssues: SentryIssue[];
  // Service status
  status: 'healthy' | 'degraded' | 'critical';
  // Connection status
  isConnected: boolean;
  lastUpdated: Date;
}

const SENTRY_API_BASE = 'https://sentry.io/api/0';

async function fetchSentryApi<T>(endpoint: string, authToken: string): Promise<T | null> {
  try {
    const response = await fetch(`${SENTRY_API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      next: { revalidate: 60 } // Cache for 1 minute
    });

    if (!response.ok) {
      console.error(`Sentry API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Sentry API fetch error:', error);
    return null;
  }
}

interface SentryStatsResponse {
  start: string;
  end: string;
  intervals: string[];
  groups: Array<{
    by: Record<string, string>;
    totals: Record<string, number>;
    series: Record<string, number[]>;
  }>;
}

interface SentryIssueResponse {
  id: string;
  title: string;
  shortId: string;
  level: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  isUnhandled: boolean;
}

export async function getSentryStats(): Promise<SentryStats> {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  if (!isSuperAdmin(session.user)) {
    throw new Error('Unauthorized: Only super admins can access Sentry stats');
  }

  const envKeys = keys();
  const org = envKeys.MONITORING_SENTRY_ORG;
  const project = envKeys.MONITORING_SENTRY_PROJECT;
  const authToken = envKeys.MONITORING_SENTRY_AUTH_TOKEN;

  // Return disconnected status if Sentry is not configured
  if (!org || !project || !authToken) {
    return {
      errors: {
        total24h: 0,
        total7d: 0,
        trend: 'stable',
        trendPercent: 0
      },
      unhandled: {
        total24h: 0,
        total7d: 0
      },
      recentIssues: [],
      status: 'healthy',
      isConnected: false,
      lastUpdated: new Date()
    };
  }

  try {
    // Fetch error stats for the last 24 hours and 7 days
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch stats for last 24h
    const stats24h = await fetchSentryApi<SentryStatsResponse>(
      `/projects/${org}/${project}/stats/?stat=received&since=${Math.floor(oneDayAgo.getTime() / 1000)}&until=${Math.floor(now.getTime() / 1000)}&resolution=1h`,
      authToken
    );

    // Fetch stats for previous 24h (for trend comparison)
    const statsPrev24h = await fetchSentryApi<SentryStatsResponse>(
      `/projects/${org}/${project}/stats/?stat=received&since=${Math.floor(twoDaysAgo.getTime() / 1000)}&until=${Math.floor(oneDayAgo.getTime() / 1000)}&resolution=1h`,
      authToken
    );

    // Fetch stats for last 7 days
    const stats7d = await fetchSentryApi<SentryStatsResponse>(
      `/projects/${org}/${project}/stats/?stat=received&since=${Math.floor(sevenDaysAgo.getTime() / 1000)}&until=${Math.floor(now.getTime() / 1000)}&resolution=1d`,
      authToken
    );

    // Fetch recent unresolved issues
    const issues = await fetchSentryApi<SentryIssueResponse[]>(
      `/projects/${org}/${project}/issues/?query=is:unresolved&sort=date&limit=5`,
      authToken
    );

    // Calculate totals from stats
    const total24h = stats24h?.groups?.[0]?.totals?.received ??
      (Array.isArray(stats24h) ? stats24h.reduce((sum: number, item: [number, number]) => sum + item[1], 0) : 0);

    const totalPrev24h = statsPrev24h?.groups?.[0]?.totals?.received ??
      (Array.isArray(statsPrev24h) ? statsPrev24h.reduce((sum: number, item: [number, number]) => sum + item[1], 0) : 0);

    const total7d = stats7d?.groups?.[0]?.totals?.received ??
      (Array.isArray(stats7d) ? stats7d.reduce((sum: number, item: [number, number]) => sum + item[1], 0) : 0);

    // Calculate trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let trendPercent = 0;

    if (totalPrev24h > 0) {
      const change = ((total24h - totalPrev24h) / totalPrev24h) * 100;
      trendPercent = Math.abs(Math.round(change));
      if (change > 10) trend = 'up';
      else if (change < -10) trend = 'down';
    }

    // Count unhandled errors from issues
    const unhandledIssues = issues?.filter(issue => issue.isUnhandled) ?? [];
    const unhandled24h = unhandledIssues.reduce((sum, issue) => {
      const lastSeen = new Date(issue.lastSeen);
      if (lastSeen >= oneDayAgo) {
        return sum + parseInt(issue.count, 10);
      }
      return sum;
    }, 0);

    const unhandled7d = unhandledIssues.reduce((sum, issue) => sum + parseInt(issue.count, 10), 0);

    // Map issues to our format
    const recentIssues: SentryIssue[] = (issues ?? []).slice(0, 5).map(issue => ({
      id: issue.id,
      title: issue.title,
      shortId: issue.shortId,
      level: (issue.level as SentryIssue['level']) || 'error',
      count: parseInt(issue.count, 10),
      userCount: issue.userCount,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      isUnhandled: issue.isUnhandled
    }));

    // Determine status based on error counts
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (unhandled24h > 10 || total24h > 100) {
      status = 'critical';
    } else if (unhandled24h > 0 || total24h > 20) {
      status = 'degraded';
    }

    return {
      errors: {
        total24h,
        total7d,
        trend,
        trendPercent
      },
      unhandled: {
        total24h: unhandled24h,
        total7d: unhandled7d
      },
      recentIssues,
      status,
      isConnected: true,
      lastUpdated: now
    };

  } catch (error) {
    console.error('Error fetching Sentry stats:', error);

    return {
      errors: {
        total24h: 0,
        total7d: 0,
        trend: 'stable',
        trendPercent: 0
      },
      unhandled: {
        total24h: 0,
        total7d: 0
      },
      recentIssues: [],
      status: 'healthy',
      isConnected: false,
      lastUpdated: new Date()
    };
  }
}