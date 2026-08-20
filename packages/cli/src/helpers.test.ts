import { describe, expect, it } from 'vitest';
import {
  askArguments,
  askQuestion,
  cliExamples,
  profiles,
  profileToolNames,
  renderExamples,
  selectAskTool,
} from './helpers.js';

describe('CLI helpers', () => {
  it('joins a natural-language question without changing its content', () => {
    expect(askQuestion(['Show', 'HDB', 'prices', 'in', 'Bedok'])).toBe('Show HDB prices in Bedok');
    expect(() => askQuestion([])).toThrow('Usage: olano-sg ask');
  });

  it('prefers the compatibility sg_ask name and detects its input property', () => {
    const tool = selectAskTool([
      { name: 'singapore_ask', inputSchema: { properties: { question: {} } } },
      { name: 'sg_ask', inputSchema: { properties: { message: {} } } },
    ]);
    expect(tool.name).toBe('sg_ask');
    expect(askArguments(tool, 'What is CPI?')).toEqual({ message: 'What is CPI?' });
  });

  it('falls back safely when an older schema omits properties', () => {
    expect(askArguments({ name: 'sg_ask' }, 'Show COE results')).toEqual({
      question: 'Show COE results',
    });
    expect(() => selectAskTool([])).toThrow('does not expose sg_ask');
  });

  it('renders broad examples deterministically and filters categories', () => {
    expect(new Set(cliExamples.map((example) => example.category)).size).toBeGreaterThanOrEqual(12);
    expect(renderExamples('rail')).toContain('List every station on the Downtown Line');
    expect(renderExamples('rail')).not.toContain('All Items CPI');
    expect(() => renderExamples('not-a-category')).toThrow('Unknown example category');
  });

  it('uses the aggregate server profile contracts when previewing tool names', () => {
    expect(profiles.mobility.prefixes).toContain('rail_');
    expect(profiles.property.prefixes).toContain('finance_mortgage_');
    expect(
      profileToolNames(
        [
          { name: 'rail_list_lines' },
          { name: 'hdb_resale_search' },
          { name: 'singapore_tool_profiles' },
        ],
        'mobility',
      ),
    ).toEqual(['rail_list_lines', 'singapore_tool_profiles']);
  });
});
