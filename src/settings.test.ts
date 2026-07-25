import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, toBlockDefaults } from './settings';
import { parseBlock } from './parser';
import { normalize } from './normalizer';

describe('toBlockDefaults', () => {
  it('maps every setting onto a block option', () => {
    const defaults = toBlockDefaults({
      defaultType: 'bar',
      defaultHeight: '250px',
      defaultXAxis: 'numeric',
      showLegend: true,
    });
    expect(defaults).toEqual({
      xAxis: 'numeric',
      height: '250px',
      style: 'bar',
      legend: true,
    });
  });

  it('supplies a chart height when the block sets none', () => {
    const chart = normalize(
      parseBlock('items:\n  - { x: 1, y: 1 }'),
      toBlockDefaults({ ...DEFAULT_SETTINGS, defaultHeight: '250px', defaultXAxis: 'numeric' })
    );
    expect(chart.height).toBe('250px');
  });

  it('lets an explicit block height beat the setting', () => {
    const chart = normalize(
      parseBlock('options: { height: 600px }\nitems:\n  - { x: 1, y: 1 }'),
      toBlockDefaults({ ...DEFAULT_SETTINGS, defaultHeight: '250px', defaultXAxis: 'numeric' })
    );
    expect(chart.height).toBe('600px');
  });

  it('lets an explicit block legend beat the setting', () => {
    const chart = normalize(
      parseBlock('options: { legend: false }\nitems:\n  - { x: 1, y: 1 }'),
      toBlockDefaults({ ...DEFAULT_SETTINGS, showLegend: true })
    );
    expect(chart.visOptions.legend).toBe(false);
  });
});
