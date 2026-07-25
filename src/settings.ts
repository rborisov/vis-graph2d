import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { BlockOptions, GraphType, XAxisMode } from './types';

export interface Graph2dSettings {
  defaultType: GraphType;
  defaultHeight: string;
  defaultXAxis: XAxisMode;
  showLegend: boolean;
}

export const DEFAULT_SETTINGS: Graph2dSettings = {
  defaultType: 'line',
  defaultHeight: '400px',
  defaultXAxis: 'time',
  showLegend: false,
};

/** Maps settings onto the block-option defaults normalize() accepts. */
export function toBlockDefaults(settings: Graph2dSettings): Partial<BlockOptions> {
  return {
    xAxis: settings.defaultXAxis,
    height: settings.defaultHeight,
    style: settings.defaultType,
    legend: settings.showLegend,
  };
}

/**
 * The plugin, described by only what this tab needs. Declaring it structurally
 * rather than importing the plugin class keeps settings.ts free of a circular
 * import back to main.ts.
 */
interface SettingsHost extends Plugin {
  settings: Graph2dSettings;
  saveSettings(): Promise<void>;
}

export class Graph2dSettingTab extends PluginSettingTab {
  private readonly host: SettingsHost;

  constructor(app: App, host: SettingsHost) {
    super(app, host);
    this.host = host;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Default graph type')
      .setDesc('Used by blocks and groups that do not set their own type.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ line: 'Line', bar: 'Bar', points: 'Points' })
          .setValue(this.host.settings.defaultType)
          .onChange(async (value) => {
            this.host.settings.defaultType = value as GraphType;
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default x-axis mode')
      .setDesc('How x values are interpreted when a block does not say.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ time: 'Time', numeric: 'Numeric', category: 'Category' })
          .setValue(this.host.settings.defaultXAxis)
          .onChange(async (value) => {
            this.host.settings.defaultXAxis = value as XAxisMode;
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default chart height')
      .setDesc('Any CSS length, for example 400px or 50vh.')
      .addText((text) =>
        text
          .setPlaceholder('400px')
          .setValue(this.host.settings.defaultHeight)
          .onChange(async (value) => {
            this.host.settings.defaultHeight = value.trim() || DEFAULT_SETTINGS.defaultHeight;
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show legend by default')
      .setDesc('Blocks can still override this with the legend option.')
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.showLegend).onChange(async (value) => {
          this.host.settings.showLegend = value;
          await this.host.saveSettings();
        })
      );
  }
}
