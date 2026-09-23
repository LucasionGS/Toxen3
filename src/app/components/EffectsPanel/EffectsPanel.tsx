import React, { Component } from "react";
import { Toxen } from "../../ToxenApp";
import Button from "../Button/Button";
import { Checkbox, Slider, Text, Stack, Divider, Alert } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import Settings from "../../toxen/Settings";
import "./EffectsPanel.scss";

interface EffectsPanelProps { }
interface EffectsPanelState { 
  audioEffectsEnabled: boolean;
}

export default class EffectsPanel extends Component<EffectsPanelProps, EffectsPanelState> {
  constructor(props: EffectsPanelProps) {
    super(props);
    this.state = {
      audioEffectsEnabled: Settings.get('audioEffectsEnabled', false),
    };
  }

  componentDidMount() {
    // Update audio effects when panel mounts
    Toxen.audioEffects?.updateEffects();
  }

  private handleAudioEffectsToggle = (enabled: boolean) => {
    this.setState({ audioEffectsEnabled: enabled });
    Settings.set('audioEffectsEnabled', enabled);
    Settings.save({ suppressNotification: true });
    Toxen.audioEffects?.updateEffects();
  };

  private handleEffectChange = (effectName: keyof typeof Settings.data, value: number) => {
    Settings.set(effectName as any, value);
    Settings.save({ suppressNotification: true });
    Toxen.audioEffects?.updateEffects();
  };

  render() {
    const rawAudio = Settings.get('rawAudioMode') ?? false;
    const audioEffectsEnabled = this.state.audioEffectsEnabled && !rawAudio;
    const crossfadeEnabled = Settings.get('crossfadeEnabled', false) && !rawAudio;
    
    return (
      <div className="adjust-panel">
        <h1>Audio Effects</h1>

        {rawAudio && (
          <Alert color="yellow" icon={<IconInfoCircle size="1em" />} mb="md">
            Raw Audio Mode is on, so audio effects and crossfade are unavailable.
            You can turn it off in <b>Settings &gt; Advanced</b>.
          </Alert>
        )}
        
        <Stack gap="md">
          <div>
            <Checkbox
              label="Enable Audio Effects"
              defaultChecked={this.state.audioEffectsEnabled}
              disabled={rawAudio}
              onChange={(e) => this.handleAudioEffectsToggle(e.currentTarget.checked)}
              mb="md"
            />

            <Stack gap="sm" style={{ opacity: audioEffectsEnabled ? 1 : 0.5 }}>
              <div>
                <Text size="sm" mb={5}>Reverb Level</Text>
                <Slider
                  defaultValue={Settings.get('audioReverbLevel', 0)}
                  onChange={(value) => this.handleEffectChange('audioReverbLevel', value)}
                  min={0}
                  max={100}
                  step={1}
                  label={(value) => `${value}%`}
                  disabled={!audioEffectsEnabled}
                />
              </div>

              <div>
                <Text size="sm" mb={5}>Echo Level</Text>
                <Slider
                  defaultValue={Settings.get('audioEchoLevel', 0)}
                  onChange={(value) => this.handleEffectChange('audioEchoLevel', value)}
                  min={0}
                  max={100}
                  step={1}
                  label={(value) => `${value}%`}
                  disabled={!audioEffectsEnabled}
                />
              </div>

              <div>
                <Text size="sm" mb={5}>Bass Boost</Text>
                <Slider
                  defaultValue={Settings.get('audioBassBoostLevel', 0)}
                  onChange={(value) => this.handleEffectChange('audioBassBoostLevel', value)}
                  min={0}
                  max={20}
                  step={1}
                  label={(value) => `${value}dB`}
                  disabled={!audioEffectsEnabled}
                />
              </div>

              <div>
                <Text size="sm" mb={5}>3D Audio Effect</Text>
                <Slider
                  defaultValue={Settings.get('audio3DLevel', 0)}
                  onChange={(value) => this.handleEffectChange('audio3DLevel', value)}
                  min={0}
                  max={100}
                  step={1}
                  label={(value) => `${value}%`}
                  disabled={!audioEffectsEnabled}
                />
              </div>
            </Stack>
          </div>

          <Divider my="md" />

          <div>
            <Text size="md" fw={600} mb="sm">Crossfade</Text>
            <Checkbox
              label="Enable Crossfade"
              defaultChecked={Settings.get('crossfadeEnabled', false)}
              disabled={rawAudio}
              onChange={(e) => {
                Settings.set('crossfadeEnabled', e.currentTarget.checked);
                Settings.save({ suppressNotification: true });
                this.forceUpdate();
              }}
              mb="md"
            />

            <div style={{ opacity: crossfadeEnabled ? 1 : 0.5 }}>
              <Text size="sm" mb={5}>Crossfade Duration</Text>
              <Slider
                defaultValue={Settings.get('crossfadeDuration', 3)}
                onChange={(value) => {
                  Settings.set('crossfadeDuration', value);
                  Settings.save({ suppressNotification: true });
                }}
                min={0.5}
                max={10}
                step={0.5}
                label={(value) => `${value}s`}
                disabled={!crossfadeEnabled}
                marks={[
                  { value: 0.5, label: '0.5s' },
                  { value: 3, label: '3s' },
                  { value: 5, label: '5s' },
                  { value: 10, label: '10s' }
                ]}
              />
            </div>
          </div>
        </Stack>
      </div>
    )
  }
}
