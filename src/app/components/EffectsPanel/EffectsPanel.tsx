import React, { Component } from "react";
import { Toxen } from "../../ToxenApp";
import Button from "../Button/Button";
import { Checkbox, Slider, Text, Stack, Divider } from "@mantine/core";
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
    const { audioEffectsEnabled } = this.state;
    
    return (
      <div className="adjust-panel">
        <h1>Audio Effects</h1>
        
        <Stack gap="md">
          <div>
            <Checkbox
              label="Enable Audio Effects"
              defaultChecked={audioEffectsEnabled}
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
        </Stack>
      </div>
    )
  }
}
