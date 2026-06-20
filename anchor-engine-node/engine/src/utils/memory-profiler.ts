/**
 * Memory Profiler for Anchor Engine
 *
 * Profiles memory usage during large ingestion and search operations.
 * Identifies memory leaks and optimization opportunities.
 *
 * @see Standard 062: Memory Management
 * @see Standard 127: Memory-Aware Search Throttling
 */

import * as v8 from 'v8';
import * as os from 'os';

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  heapUsedPercent: number;
  rss: number;
  external: number;
  arrayBuffers: number;
  heapStats: v8.HeapInfo;
  heapSpaceStats: v8.HeapSpaceInfo[];
  label?: string;
}

export interface MemoryLeakSuspect {
  type: string;
  growth: number; // bytes per operation
  confidence: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

export interface MemoryProfile {
  operation: string;
  startTime: number;
  endTime: number;
  startMemory: MemorySnapshot;
  endMemory: MemorySnapshot;
  peakMemory: MemorySnapshot;
  snapshots: MemorySnapshot[];
  leakSuspects: MemoryLeakSuspect[];
  recommendations: string[];
}

export interface MemoryThresholds {
  warning: number; // Percentage
  critical: number; // Percentage
  emergency: number; // Percentage
}

const DEFAULT_THRESHOLDS: MemoryThresholds = {
  warning: 70,
  critical: 85,
  emergency: 95,
};

class MemoryProfiler {
  private snapshots: MemorySnapshot[] = [];
  private profiles: Map<string, MemoryProfile> = new Map();
  private thresholds: MemoryThresholds = DEFAULT_THRESHOLDS;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  /**
   * Take a memory snapshot
   */
  takeSnapshot(label?: string): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapSpaceStats = v8.getHeapSpaceStatistics();

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: heapStats.used_heap_size || 0,
      heapTotal: heapStats.total_heap_size || 0,
      heapUsedPercent: ((heapStats.used_heap_size || 0) / (heapStats.total_heap_size || 1)) * 100,
      rss: memUsage.rss,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      heapStats,
      heapSpaceStats,
      label,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Start profiling an operation
   */
  startProfile(operation: string): void {
    // Force GC before starting if available
    this.forceGC();

    const startMemory = this.takeSnapshot(`${operation} - start`);

    this.profiles.set(operation, {
      operation,
      startTime: Date.now(),
      endTime: 0,
      startMemory,
      endMemory: startMemory,
      peakMemory: startMemory,
      snapshots: [startMemory],
      leakSuspects: [],
      recommendations: [],
    });
  }

  /**
   * End profiling an operation
   */
  endProfile(operation: string): MemoryProfile | null {
    const profile = this.profiles.get(operation);
    if (!profile) {
      console.warn(`[MemoryProfiler] No profile found for operation: ${operation}`);
      return null;
    }

    // Force GC before ending to get accurate measurement
    this.forceGC();

    const endMemory = this.takeSnapshot(`${operation} - end`);
    profile.endTime = Date.now();
    profile.endMemory = endMemory;
    profile.snapshots.push(endMemory);

    // Update peak memory
    for (const snapshot of profile.snapshots) {
      if (snapshot.heapUsed > profile.peakMemory.heapUsed) {
        profile.peakMemory = snapshot;
      }
    }

    // Analyze for leaks
    profile.leakSuspects = this.analyzeLeaks(profile);
    profile.recommendations = this.generateRecommendations(profile);

    this.profiles.set(operation, profile);
    return profile;
  }

  /**
   * Get profile for an operation
   */
  getProfile(operation: string): MemoryProfile | undefined {
    return this.profiles.get(operation);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): Map<string, MemoryProfile> {
    return new Map(this.profiles);
  }

  /**
   * Clear all profiles
   */
  clearProfiles(): void {
    this.profiles.clear();
    this.snapshots = [];
  }

  /**
   * Start continuous memory monitoring
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
      this.checkThresholds();
    }, intervalMs);

    if (this.monitoringInterval.unref) {
      this.monitoringInterval.unref();
    }

    console.log(`[MemoryProfiler] Started monitoring (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop continuous memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.isMonitoring = false;
      console.log('[MemoryProfiler] Stopped monitoring');
    }
  }

  /**
   * Check memory thresholds and log warnings
   */
  private checkThresholds(): void {
    const current = this.snapshots[this.snapshots.length - 1];
    if (!current) return;

    const percent = current.heapUsedPercent;

    if (percent >= this.thresholds.emergency) {
      console.error(
        `[MemoryProfiler] EMERGENCY: Memory at ${percent.toFixed(1)}% - Immediate action required!`
      );
    } else if (percent >= this.thresholds.critical) {
      console.warn(
        `[MemoryProfiler] CRITICAL: Memory at ${percent.toFixed(1)}% - Consider reducing load`
      );
    } else if (percent >= this.thresholds.warning) {
      console.warn(
        `[MemoryProfiler] WARNING: Memory at ${percent.toFixed(1)}% - Monitoring closely`
      );
    }
  }

  /**
   * Analyze profile for memory leaks
   */
  private analyzeLeaks(profile: MemoryProfile): MemoryLeakSuspect[] {
    const suspects: MemoryLeakSuspect[] = [];
    const { startMemory, endMemory, peakMemory, snapshots } = profile;

    // Calculate memory growth
    const heapGrowth = endMemory.heapUsed - startMemory.heapUsed;
    const rssGrowth = endMemory.rss - startMemory.rss;
    const externalGrowth = endMemory.external - startMemory.external;

    const durationSec = (profile.endTime - profile.startTime) / 1000;
    const operationsCount = snapshots.length;

    // Suspect 1: Heap growth without GC
    if (heapGrowth > 10 * 1024 * 1024) { // > 10MB growth
      suspects.push({
        type: 'heap_growth',
        growth: heapGrowth,
        confidence: heapGrowth > 50 * 1024 * 1024 ? 'high' : 'medium',
        description: `Heap grew by ${(heapGrowth / 1024 / 1024).toFixed(2)}MB during operation`,
        recommendation: 'Check for unclosed resources, large cached objects, or circular references',
      });
    }

    // Suspect 2: External memory growth (ArrayBuffers, native objects)
    if (externalGrowth > 5 * 1024 * 1024) { // > 5MB growth
      suspects.push({
        type: 'external_memory_growth',
        growth: externalGrowth,
        confidence: externalGrowth > 20 * 1024 * 1024 ? 'high' : 'medium',
        description: `External memory grew by ${(externalGrowth / 1024 / 1024).toFixed(2)}MB`,
        recommendation: 'Check for unreleased ArrayBuffers, file handles, or native objects',
      });
    }

    // Suspect 3: RSS growth without heap growth (native memory leak)
    if (rssGrowth > 20 * 1024 * 1024 && heapGrowth < 5 * 1024 * 1024) {
      suspects.push({
        type: 'native_memory_leak',
        growth: rssGrowth - heapGrowth,
        confidence: 'medium',
        description: `RSS grew significantly more than heap (${(rssGrowth / 1024 / 1024).toFixed(2)}MB vs ${(heapGrowth / 1024 / 1024).toFixed(2)}MB)`,
        recommendation: 'Check WASM modules, file streams, or worker threads for leaks',
      });
    }

    // Suspect 4: Continuous growth pattern
    if (snapshots.length >= 3) {
      let continuousGrowth = true;
      for (let i = 2; i < snapshots.length; i++) {
        if (snapshots[i].heapUsed <= snapshots[i - 1].heapUsed) {
          continuousGrowth = false;
          break;
        }
      }

      if (continuousGrowth && heapGrowth > 5 * 1024 * 1024) {
        suspects.push({
          type: 'continuous_growth',
          growth: heapGrowth / operationsCount,
          confidence: 'high',
          description: 'Memory shows continuous growth pattern without plateaus',
          recommendation: 'Likely memory leak - check for accumulating data structures',
        });
      }
    }

    return suspects;
  }

  /**
   * Generate recommendations based on profile
   */
  private generateRecommendations(profile: MemoryProfile): string[] {
    const recommendations: string[] = [];
    const { startMemory, endMemory, peakMemory } = profile;

    const heapGrowth = endMemory.heapUsed - startMemory.heapUsed;
    const peakUsage = peakMemory.heapUsedPercent;

    // High peak memory
    if (peakUsage > 80) {
      recommendations.push(
        `Peak memory usage was ${(peakUsage).toFixed(1)}% - consider processing in smaller batches`
      );
    }

    // Significant memory growth
    if (heapGrowth > 50 * 1024 * 1024) {
      recommendations.push(
        `Memory grew by ${(heapGrowth / 1024 / 1024).toFixed(1)}MB - investigate objects retained between start and end`
      );
    }

    // Long-running operation
    const duration = profile.endTime - profile.startTime;
    if (duration > 60000) { // > 1 minute
      recommendations.push(
        `Operation took ${(duration / 1000).toFixed(1)}s - consider breaking into smaller operations`
      );
    }

    // High external memory
    if (endMemory.external > 50 * 1024 * 1024) {
      recommendations.push(
        `External memory is ${(endMemory.external / 1024 / 1024).toFixed(1)}MB - check ArrayBuffers and native objects`
      );
    }

    // GC recommendation
    if (heapGrowth > 10 * 1024 * 1024) {
      recommendations.push(
        'Consider calling memoryProfiler.forceGC() before memory-intensive operations'
      );
    }

    return recommendations;
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Get memory statistics in human-readable format
   */
  getMemoryStats(): string {
    const current = this.takeSnapshot('stats');
    const mb = 1024 * 1024;

    return `
Memory Statistics:
  Heap: ${(current.heapUsed / mb).toFixed(2)}MB / ${(current.heapTotal / mb).toFixed(2)}MB (${current.heapUsedPercent.toFixed(1)}%)
  RSS: ${(current.rss / mb).toFixed(2)}MB
  External: ${(current.external / mb).toFixed(2)}MB
  ArrayBuffers: ${(current.arrayBuffers / mb).toFixed(2)}MB
`.trim();
  }

  /**
   * Print profile report
   */
  printProfileReport(operation: string): void {
    const profile = this.profiles.get(operation);
    if (!profile) {
      console.log(`No profile found for: ${operation}`);
      return;
    }

    const mb = 1024 * 1024;
    const duration = profile.endTime - profile.startTime;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Memory Profile: ${operation}`);
    console.log('='.repeat(60));
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`\nMemory Usage:`);
    console.log(`  Start: ${(profile.startMemory.heapUsed / mb).toFixed(2)}MB`);
    console.log(`  End: ${(profile.endMemory.heapUsed / mb).toFixed(2)}MB`);
    console.log(`  Peak: ${(profile.peakMemory.heapUsed / mb).toFixed(2)}MB`);
    console.log(`  Growth: ${((profile.endMemory.heapUsed - profile.startMemory.heapUsed) / mb).toFixed(2)}MB`);

    if (profile.leakSuspects.length > 0) {
      console.log(`\n⚠️  Potential Memory Leaks (${profile.leakSuspects.length}):`);
      for (const suspect of profile.leakSuspects) {
        console.log(`  [${suspect.confidence.toUpperCase()}] ${suspect.type}: ${suspect.description}`);
        console.log(`    → ${suspect.recommendation}`);
      }
    }

    if (profile.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      for (const rec of profile.recommendations) {
        console.log(`  • ${rec}`);
      }
    }

    console.log('='.repeat(60));
  }

  /**
   * Export profile to JSON
   */
  exportProfile(operation: string): string | null {
    const profile = this.profiles.get(operation);
    if (!profile) return null;

    // Remove non-serializable data
    const exportable = {
      ...profile,
      snapshots: profile.snapshots.map(s => ({
        timestamp: s.timestamp,
        heapUsed: s.heapUsed,
        heapTotal: s.heapTotal,
        heapUsedPercent: s.heapUsedPercent,
        rss: s.rss,
        external: s.external,
        arrayBuffers: s.arrayBuffers,
        label: s.label,
      })),
    };

    return JSON.stringify(exportable, null, 2);
  }
}

// Singleton instance
export const memoryProfiler = new MemoryProfiler();

// Export for testing
export { MemoryProfiler };
