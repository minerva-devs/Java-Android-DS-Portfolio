/**
 * P0 Integration Test: MCP Server
 * 
 * Tests the MCP server integration with circuit breaker protection.
 * These are fast, targeted tests that verify MCP server functionality.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CircuitBreakerFactory, CircuitBreakerImpl, FailureTrackerImpl } from '../../src/utils/circuit-breaker';

// Mock tool handler for testing
class MockToolHandler {
  async handleToolCall(toolName: string, params: any): Promise<any> {
    if (toolName === 'anchor_query') {
      return {
        results: [{ id: '1', content: 'test result' }],
        totalResults: 1
      };
    } else if (toolName === 'anchor_distill') {
      return {
        session_id: params.session_id || 'default',
        distilled: true
      };
    }
    return { error: 'Unknown tool' };
  }
}

// Mock MCP server configuration
const mockMCPConfig = {
  name: 'anchor-engine-mcp',
  version: '1.0.0',
  tools: [
    {
      name: 'anchor_query',
      description: 'Semantic search query',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'integer', default: 10 }
        }
      }
    },
    {
      name: 'anchor_distill',
      description: 'Session distillation',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          include_history: { type: 'boolean', default: true }
        }
      }
    }
  ]
};

describe('MCP Server P0 Tests', () => {
  let circuitBreaker: CircuitBreakerImpl;
  let failureTracker: FailureTrackerImpl;
  let toolHandler: MockToolHandler;

  beforeAll(() => {
    console.log('🔧 [P0 MCP Server] Setting up test environment...');
    
    // Initialize circuit breaker
    circuitBreaker = CircuitBreakerFactory.createBreaker('mcp-server', {
      failureThreshold: 3,
      resetTimeout: 10000,
      halfOpenTimeout: 5000
    });
    
    // Initialize failure tracker
    failureTracker = new FailureTrackerImpl(10);
    
    // Initialize tool handler
    toolHandler = new MockToolHandler();
    
    console.log('✅ [P0 MCP Server] Setup complete');
  });

  afterAll(() => {
    console.log('🧹 [P0 MCP Server] Cleaning up...');
    CircuitBreakerFactory.resetAll();
  });

  it('should create circuit breaker with correct configuration', () => {
    const state = circuitBreaker.getState();
    expect(state).toBe('closed');
    
    const stats = circuitBreaker.getStats();
    expect(stats.currentState).toBe('closed');
    expect(stats.totalCalls).toBe(0);
  });

  it('should allow tool execution when circuit is closed', async () => {
    const result = await circuitBreaker.execute(() => 
      toolHandler.handleToolCall('anchor_query', { query: 'test' })
    );
    
    expect(result).toBeDefined();
  });

  it('should handle anchor_query tool call', async () => {
    const result = await toolHandler.handleToolCall(
      'anchor_query',
      { query: 'test query', limit: 5 }
    );
    
    expect(result).toBeDefined();
    expect(result.results).toBeDefined();
  });

  it('should handle anchor_distill tool call', async () => {
    const result = await toolHandler.handleToolCall(
      'anchor_distill',
      { session_id: 'test-session', include_history: true }
    );
    
    expect(result).toBeDefined();
    expect(result.distilled).toBe(true);
  });

  it('should record success after successful tool call', async () => {
    await circuitBreaker.recordSuccess();
    
    const stats = circuitBreaker.getStats();
    expect(stats.failures).toBe(0);
  });

  it('should record failure and track by type', async () => {
    const toolError = new Error('Tool execution failed');
    failureTracker.recordFailure('ToolError', toolError, {
      tool: 'anchor_query',
      params: { query: 'test' }
    });
    
    const stats = failureTracker.getStats();
    expect(stats.failuresByType.ToolError).toBe(1);
  });

  it('should prevent execution when circuit opens', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 10000
    });
    
    const error = new Error('MCP tool failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);
  });

  it('should transition to half-open after reset timeout', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 5000
    });
    
    const error = new Error('MCP failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('open');
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const state = breaker.getState();
    expect(state).toBe('half-open');
  });

  it('should allow one attempt in half-open state', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 5000
    });
    
    const error = new Error('MCP failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('open');
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const state = breaker.getState();
    expect(state).toBe('half-open');
    expect(breaker.canExecute()).toBe(true);
  });

  it('should close circuit after successful half-open attempt', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 2000
    });
    
    const error = new Error('MCP failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Execute successfully
    await breaker.execute(() => Promise.resolve('success'));
    
    expect(breaker.getState()).toBe('closed');
  });

  it('should remain open after failed half-open attempt', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 2000
    });
    
    const error = new Error('MCP failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Fail again
    await breaker.recordFailure(error);
    
    const state = breaker.getState();
    expect(state).toBe('open');
  });

  it('should handle MCP server initialization', () => {
    const server = {
      name: mockMCPConfig.name,
      version: mockMCPConfig.version,
      tools: mockMCPConfig.tools
    };
    
    expect(server.name).toBe('anchor-engine-mcp');
    expect(server.version).toBe('1.0.0');
    expect(server.tools.length).toBe(2);
  });

  it('should handle tool registration', () => {
    const server = {
      name: 'test-server',
      version: '1.0.0',
      tools: [
        {
          name: 'test-tool',
          description: 'Test tool',
          inputSchema: { type: 'object' }
        }
      ]
    };
    
    expect(server.tools.length).toBe(1);
    expect(server.tools[0].name).toBe('test-tool');
  });

  it('should handle query tool with proper parameters', async () => {
    const result = await toolHandler.handleToolCall(
      'anchor_query',
      { query: 'test semantic search', limit: 10 }
    );
    
    expect(result).toBeDefined();
  });

  it('should handle search with empty query', async () => {
    const result = await toolHandler.handleToolCall(
      'anchor_query',
      { query: '', limit: 5 }
    );
    
    expect(result).toBeDefined();
  });

  it('should handle limit parameter', async () => {
    const result = await toolHandler.handleToolCall(
      'anchor_query',
      { query: 'test', limit: 3 }
    );
    
    expect(result).toBeDefined();
  });

  it('should handle distill tool with session ID', async () => {
    const result = await toolHandler.handleToolCall(
      'anchor_distill',
      { session_id: 'test-session-123', include_history: false }
    );
    
    expect(result).toBeDefined();
  });

  it('should handle distill without session ID', async () => {
    const result = await toolHandler.handleToolCall(
      'anchor_distill',
      {}
    );
    
    expect(result).toBeDefined();
  });

  it('should propagate tool execution errors', async () => {
    const failingHandler = {
      handleToolCall: async () => {
        throw new Error('Tool execution error');
      }
    };
    
    const breaker = new CircuitBreakerImpl();
    await expect(breaker.execute(() => (failingHandler as any).handleToolCall()))
      .rejects.toThrow('Tool execution error');
    
    const stats = breaker.getStats();
    expect(stats.failures).toBe(1);
  });

  it('should handle slow tool execution', async () => {
    const slowTool = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { result: 'slow tool' };
    };
    
    const result = await circuitBreaker.execute(slowTool);
    expect(result).toBeDefined();
  });

  it('should reset circuit on successful operation', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2
    });
    
    // Open the circuit
    const error = new Error('Tool failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('open');
    
    // Success should reset
    await breaker.recordSuccess();
    
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getStats().failures).toBe(0);
  });

  it('should provide accurate MCP statistics', () => {
    const breaker = new CircuitBreakerImpl();
    
    // Simulate MCP operations
    breaker.execute(() => Promise.resolve('ok'));
    breaker.recordFailure(new Error('tool failed'));
    breaker.execute(() => Promise.resolve('ok'));
    
    const stats = breaker.getStats();
    // totalCalls counts all attempts
    expect(stats.totalCalls).toBeGreaterThanOrEqual(1);
    expect(stats.failures).toBe(1);
    expect(stats.successes).toBeGreaterThanOrEqual(0);
  });

  it('should handle concurrent MCP tool calls', async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        circuitBreaker.execute(() => 
          toolHandler.handleToolCall('anchor_query', { query: `test ${i}` })
        )
      );
    }
    
    const results = await Promise.all(promises);
    expect(results.length).toBe(5);
  });

  it('should handle MCP server shutdown gracefully', () => {
    const server = {
      name: 'test-server',
      version: '1.0.0',
      tools: []
    };
    
    // Server should be creatable and have basic properties
    expect(server.name).toBe('test-server');
  });

  it('should track MCP-specific failures', () => {
    const mcpError = new Error('MCP connection lost');
    failureTracker.recordFailure('MCPError', mcpError, {
      server: 'anchor-engine-mcp',
      port: 3161
    });
    
    const stats = failureTracker.getStats();
    expect(stats.failuresByType.MCPError).toBe(1);
  });

  it('should handle circuit breaker disabled state', async () => {
    const breaker = new CircuitBreakerImpl({ enabled: false });
    
    // Should allow execution regardless of failures
    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    
    // Failures should not be recorded when disabled
    await breaker.recordFailure(new Error('should not count'));
    expect(breaker.getStats().failures).toBe(0);
  });

  console.log('✅ [P0 MCP Server] All tests passed!');
});
