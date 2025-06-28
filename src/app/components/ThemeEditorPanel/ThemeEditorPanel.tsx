import React, { Component } from 'react'
import { ColorInput, TextInput, Textarea, Button, Group, Text, Divider, Card, Badge, Alert } from '@mantine/core'
import { IconPalette, IconCode, IconDeviceFloppy, IconPlayerPlay, IconInfoCircle, IconX, IconArrowLeft } from '@tabler/icons-react'
import Theme, { ThemeStyleTemplate } from '../../toxen/Theme'
import { Toxen } from '../../ToxenApp'
import Expandable from '../Expandable/Expandable'
import SidepanelSectionHeader from '../Sidepanel/SidepanelSectionHeader'
import SidepanelSectionGroup from '../Sidepanel/SidepanelSectionGroup'

interface State {
  customCSS: string;
  currentTheme: Theme | null;
  originalTheme: Theme | null; // Store the original theme to revert to
  isEditingExisting: boolean;
}

interface Props {

}

export default class ThemeEditorPanel extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    // Check if we're editing an existing theme or need to create a new one
    const existingTheme = Toxen.theme;
    const canEditExisting = existingTheme && 
                           existingTheme.name !== "" && 
                           existingTheme.name !== "Default" && 
                           existingTheme.name !== "Toxen Default" &&
                           !existingTheme.name.startsWith("Custom Theme");
    
    let workingTheme: Theme;
    if (canEditExisting && existingTheme) {
      // Clone the existing theme for editing
      workingTheme = Theme.create({
        name: existingTheme.name,
        displayName: existingTheme.displayName,
        description: existingTheme.description,
        styles: { ...existingTheme.styles },
        customCSS: existingTheme.customCSS
      });
    } else {
      // Create a new theme based on current defaults
      workingTheme = Theme.createDefaultTheme();
      workingTheme.name = `Custom Theme ${new Date().toLocaleDateString()}`;
      workingTheme.displayName = `My Custom Theme`;
      workingTheme.description = "A custom theme created in the theme editor";
    }
    
    this.state = {
      customCSS: workingTheme.customCSS || '',
      currentTheme: workingTheme,
      originalTheme: existingTheme ? Theme.create({
        name: existingTheme.name,
        displayName: existingTheme.displayName,
        description: existingTheme.description,
        styles: { ...existingTheme.styles },
        customCSS: existingTheme.customCSS
      }) : null,
      isEditingExisting: canEditExisting
    };
  }

  private rgbToHex = (rgb: [number, number, number]): string => {
    return "#" + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
  }

  private hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  }

  private updateThemeStyle = (styleKey: string, value: any) => {
    const workingTheme = this.state.currentTheme;
    if (!workingTheme) return;

    if (!workingTheme.styles) {
      workingTheme.styles = {};
    }

    const template = this.getStyleTemplate(styleKey);
    if (template) {
      workingTheme.styles[styleKey] = {
        ...template,
        value: template.type === 'color' ? this.hexToRgb(value) : value
      };
    }

    // Create a new theme object to trigger re-render
    const updatedTheme = Theme.create({
      name: workingTheme.name,
      displayName: workingTheme.displayName,
      description: workingTheme.description,
      styles: { ...workingTheme.styles },
      customCSS: workingTheme.customCSS
    });

    // Update state and apply theme for preview
    this.setState({ currentTheme: updatedTheme }, () => {
      Toxen.setTheme(updatedTheme);
    });
  }

  private getStyleTemplate = (styleKey: string) => {
    for (const sectionName in ThemeStyleTemplate) {
      const section = ThemeStyleTemplate[sectionName];
      for (const key in section) {
        if (key === styleKey) {
          return section[key];
        }
      }
    }
    return null;
  }

  private getCurrentValue = (styleKey: string): any => {
    const currentStyle = this.state.currentTheme?.styles?.[styleKey];
    const template = this.getStyleTemplate(styleKey);
    
    if (currentStyle?.value) {
      return template?.type === 'color' ? this.rgbToHex(currentStyle.value as [number, number, number]) : currentStyle.value;
    }
    
    if (template?.defaultValue) {
      return template.type === 'color' ? this.rgbToHex(template.defaultValue as [number, number, number]) : template.defaultValue;
    }
    
    return template?.type === 'color' ? '#000000' : '';
  }

  private saveTheme = () => {
    const workingTheme = this.state.currentTheme;
    if (workingTheme) {
      workingTheme.customCSS = this.state.customCSS;
      
      // Set as the active theme and save
      Toxen.setTheme(workingTheme);
      workingTheme.save();
      
      // Add to themes list if it's a new theme
      if (!this.state.isEditingExisting) {
        const existingIndex = Toxen.themes.findIndex(t => t.name === workingTheme.name);
        if (existingIndex === -1) {
          Toxen.themes.push(workingTheme);
        } else {
          Toxen.themes[existingIndex] = workingTheme;
        }
      }
    }
    Toxen.setMode("Player");
  }

  private resetToDefaults = () => {
    const workingTheme = this.state.currentTheme;
    if (workingTheme) {
      // Reset to default theme values but keep name and description
      const defaultTheme = Theme.createDefaultTheme();
      const resetTheme = Theme.create({
        name: workingTheme.name,
        displayName: workingTheme.displayName,
        description: workingTheme.description,
        styles: { ...defaultTheme.styles },
        customCSS: ''
      });
      
      this.setState({ 
        customCSS: '', 
        currentTheme: resetTheme 
      }, () => {
        Toxen.setTheme(resetTheme);
      });
    }
  }

  private loadPresetTheme = (presetType: 'default' | 'blue' | 'purple') => {
    let presetTheme: Theme;
    
    switch (presetType) {
      case 'blue':
        presetTheme = Theme.createDarkBlueTheme();
        break;
      case 'purple':
        presetTheme = Theme.createPurpleTheme();
        break;
      default:
        presetTheme = Theme.createDefaultTheme();
        break;
    }
    
    // Copy current name and description if editing existing theme
    if (this.state.currentTheme) {
      const updatedTheme = Theme.create({
        name: this.state.currentTheme.name,
        displayName: this.state.currentTheme.displayName,
        description: this.state.currentTheme.description,
        styles: { ...presetTheme.styles },
        customCSS: presetTheme.customCSS || ''
      });
      
      this.setState({ 
        currentTheme: updatedTheme,
        customCSS: updatedTheme.customCSS || ''
      }, () => {
        Toxen.setTheme(updatedTheme);
      });
    }
  }

  private updateThemeName = (name: string) => {
    const workingTheme = this.state.currentTheme;
    if (workingTheme) {
      const updatedTheme = Theme.create({
        name: name,
        displayName: name,
        description: workingTheme.description,
        styles: { ...workingTheme.styles },
        customCSS: workingTheme.customCSS
      });
      this.setState({ currentTheme: updatedTheme });
    }
  }

  private updateThemeDescription = (description: string) => {
    const workingTheme = this.state.currentTheme;
    if (workingTheme) {
      const updatedTheme = Theme.create({
        name: workingTheme.name,
        displayName: workingTheme.displayName,
        description: description,
        styles: { ...workingTheme.styles },
        customCSS: workingTheme.customCSS
      });
      this.setState({ currentTheme: updatedTheme });
    }
  }

  private cancelChanges = () => {
    // Revert to the original theme if it exists, otherwise go back to default
    const originalTheme = this.state.originalTheme;
    if (originalTheme) {
      Toxen.setTheme(originalTheme);
    } else {
      // If no original theme, load the default theme
      const defaultTheme = Theme.createDefaultTheme();
      Toxen.setTheme(defaultTheme);
    }
    
    // Go back to player mode
    Toxen.setMode("Player");
  }

  render() {
    const workingTheme = this.state.currentTheme;
    if (!workingTheme) return <div>Loading...</div>;
    
    return (
      <div>
        <SidepanelSectionHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconPalette size={24} />
            Theme Editor
            {!this.state.isEditingExisting && (
              <Badge variant="light" color="green" size="sm">New Theme</Badge>
            )}
          </div>
          <Group gap="sm">
            <Button 
              variant="outline" 
              size="sm"
              color="gray"
              leftSection={<IconArrowLeft size={16} />}
              onClick={this.cancelChanges}
            >
              Cancel
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                // Create a brand new theme
                const newTheme = Theme.createDefaultTheme();
                const timestamp = new Date().toLocaleString().replace(/[/:]/g, '-');
                newTheme.name = `Custom Theme ${timestamp}`;
                newTheme.displayName = `My Custom Theme`;
                newTheme.description = "A new custom theme";
                
                this.setState({ 
                  currentTheme: newTheme,
                  customCSS: '',
                  isEditingExisting: false
                }, () => {
                  Toxen.setTheme(newTheme);
                });
              }}
            >
              New Theme
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={this.resetToDefaults}
            >
              Reset to Defaults
            </Button>
            <Button 
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={this.saveTheme}
            >
              Save & Apply
            </Button>
          </Group>
        </SidepanelSectionHeader>

        <Alert 
          icon={<IconInfoCircle size={16} />} 
          title={this.state.isEditingExisting ? "Editing Existing Theme" : "Creating New Theme"} 
          color={this.state.isEditingExisting ? "yellow" : "green"}
          style={{ marginBottom: 24 }}
        >
          {this.state.isEditingExisting 
            ? <span>You're editing an existing theme. Changes are applied immediately for preview. <br/>Use 'Cancel' to discard changes or 'Save' to keep them.</span> 
            : <span>You're creating a new custom theme. Changes are applied immediately for preview. <br/>Use 'Cancel' to discard and return to the previous theme, or 'Save' to create the theme.</span>
          }
        </Alert>

        {/* Theme Metadata Section */}
        <SidepanelSectionGroup>
          <Expandable 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconCode size={16} />
                Theme Information
              </div>
            }
            expanded={true}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <TextInput
                label="Theme Name"
                value={workingTheme.name}
                onChange={(event) => this.updateThemeName(event.target.value)}
                placeholder="Enter theme name"
              />
              <TextInput
                label="Display Name"
                value={workingTheme.displayName || workingTheme.name}
                onChange={(event) => {
                  const workingTheme = this.state.currentTheme;
                  if (workingTheme) {
                    const updatedTheme = Theme.create({
                      name: workingTheme.name,
                      displayName: event.target.value,
                      description: workingTheme.description,
                      styles: { ...workingTheme.styles },
                      customCSS: workingTheme.customCSS
                    });
                    this.setState({ currentTheme: updatedTheme });
                  }
                }}
                placeholder="Enter display name"
              />
              <Textarea
                label="Description"
                value={workingTheme.description}
                onChange={(event) => this.updateThemeDescription(event.target.value)}
                placeholder="Describe your theme"
                minRows={2}
                maxRows={4}
                autosize
              />
              
              <div>
                <Text size="sm" fw={600} style={{ marginBottom: 8 }}>Load Preset Colors</Text>
                <Group gap="sm">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => this.loadPresetTheme('default')}
                  >
                    Default Green
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => this.loadPresetTheme('blue')}
                  >
                    Dark Blue
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => this.loadPresetTheme('purple')}
                  >
                    Purple
                  </Button>
                </Group>
                <Text size="xs" c="var(--text-muted)" style={{ marginTop: 4 }}>
                  Load a preset color scheme while keeping your theme name and description
                </Text>
              </div>
            </div>
          </Expandable>
        </SidepanelSectionGroup>

        {Object.entries(ThemeStyleTemplate).map(([sectionName, section]) => (
          <SidepanelSectionGroup key={sectionName}>
            <Expandable 
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge variant="light" size="sm">{Object.keys(section).length}</Badge>
                  {sectionName}
                </div>
              }
              expanded={sectionName === "Core Colors"}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(section).map(([styleKey, style]) => (
                  <Card 
                    key={styleKey} 
                    padding="md" 
                    radius="md"
                    style={{ 
                      background: 'var(--surface-bg)', 
                      border: '1px solid var(--border-secondary)' 
                    }}
                  >
                    <div style={{ marginBottom: 12 }}>
                      <Text size="sm" fw={600} c="var(--text-primary)">
                        {style.title}
                      </Text>
                      {style.description && (
                        <Text size="xs" c="var(--text-muted)" style={{ marginTop: 4 }}>
                          {style.description}
                        </Text>
                      )}
                      {style.cssVariable && (
                        <Badge variant="outline" size="xs" style={{ marginTop: 6 }}>
                          {style.cssVariable}
                        </Badge>
                      )}
                    </div>
                    
                    {style.type === 'color' ? (
                      <ColorInput
                        value={this.getCurrentValue(styleKey)}
                        onChange={(value) => this.updateThemeStyle(styleKey, value)}
                        format="hex"
                        swatches={[
                          // Green variants (default theme)
                          '#b6ffba', '#4ade80', '#22c55e', '#16a34a',
                          // Blue variants  
                          '#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa',
                          // Purple variants
                          '#8b5cf6', '#7c3aed', '#6d28d9', '#a855f7',
                          // Other useful colors
                          '#ff6b35', '#ef4444', '#fbbf24', '#ec4899',
                          // Neutral variants
                          '#6b7280', '#374151', '#1f2937', '#111827'
                        ]}
                        withEyeDropper
                      />
                    ) : (
                      <TextInput
                        value={this.getCurrentValue(styleKey)}
                        onChange={(event) => this.updateThemeStyle(styleKey, event.target.value)}
                        placeholder={`Enter ${style.type} value`}
                      />
                    )}
                  </Card>
                ))}
              </div>
            </Expandable>
          </SidepanelSectionGroup>
        ))}

        <SidepanelSectionGroup>
          <Expandable title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCode size={16} />
              Custom CSS
            </div>
          }>
            <div style={{ marginBottom: 16 }}>
              <Text size="sm" c="var(--text-secondary)" style={{ marginBottom: 8 }}>
                Add your own custom CSS to further customize the appearance. Use CSS variables from above for consistency.
              </Text>
              <Text size="xs" c="var(--text-muted)">
                Example: .my-custom-element {'{'}background: var(--accent-color); border-radius: 8px;{'}'}
              </Text>
            </div>
            <Textarea
              value={this.state.customCSS}
              onChange={(event) => {
                const newCSS = event.target.value;
                const workingTheme = this.state.currentTheme;
                
                this.setState({ customCSS: newCSS });
                
                if (workingTheme) {
                  const updatedTheme = Theme.create({
                    name: workingTheme.name,
                    displayName: workingTheme.displayName,
                    description: workingTheme.description,
                    styles: { ...workingTheme.styles },
                    customCSS: newCSS
                  });
                  this.setState({ currentTheme: updatedTheme }, () => {
                    Toxen.setTheme(updatedTheme);
                  });
                }
              }}
              placeholder="/* Your custom CSS here */"
              minRows={6}
              maxRows={12}
              autosize
              style={{ fontFamily: 'monospace' }}
            />
          </Expandable>
        </SidepanelSectionGroup>

        <Divider style={{ margin: '32px 0' }} />
        
        <Group justify="center" gap="md">
          <Button 
            variant="outline" 
            color="gray"
            leftSection={<IconX size={18} />}
            onClick={this.cancelChanges}
            size="lg"
          >
            Cancel & Exit
          </Button>
          <Button 
            variant="outline" 
            onClick={this.resetToDefaults}
            size="lg"
          >
            Reset All
          </Button>
          <Button 
            leftSection={<IconDeviceFloppy size={18} />}
            onClick={this.saveTheme}
            size="lg"
          >
            Save Theme
          </Button>
        </Group>
      </div>
    )
  }
}
