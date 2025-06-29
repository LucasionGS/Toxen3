import React, { Component } from 'react';
import { Button, TextInput, NumberInput, Select, ColorPicker, Modal, ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus, IconTrash, IconPlayerPlay, IconPlayerPause, IconUpload, IconDownload, IconEdit, IconCheck, IconX } from '@tabler/icons-react';
import SubtitleParser from '../../toxen/SubtitleParser';
import Time from '../../toxen/Time';
import Song from '../../toxen/Song';
import { Toxen } from '../../ToxenApp';
import ToxenInteractionMode from '../../toxen/ToxenInteractionMode';
import './SubtitleEditor.scss';

interface SubtitleEditorProps {
  song?: Song;
  onClose?: () => void;
}

interface SubtitleEditorState {
  subtitles: SubtitleParser.SubtitleArray;
  selectedItem: SubtitleParser.SubtitleItem | null;
  editingItem: SubtitleParser.SubtitleItem | null;
  currentTime: Time;
  isPlaying: boolean;
  isDirty: boolean;
  showOptions: boolean;
  newItemModal: boolean;
}

export default class SubtitleEditor extends Component<SubtitleEditorProps, SubtitleEditorState> {
  private timelineRef = React.createRef<HTMLDivElement>();
  private updateInterval: number;

  constructor(props: SubtitleEditorProps) {
    super(props);

    const subtitles = new SubtitleParser.SubtitleArray();
    subtitles.type = "tst"; // Default to TST format
    
    this.state = {
      subtitles: subtitles,
      selectedItem: null,
      editingItem: null,
      currentTime: new Time(0),
      isPlaying: false,
      isDirty: false,
      showOptions: false,
      newItemModal: false,
    };

    this.loadSubtitles();
    this.setupUpdateLoop();
  }

  componentDidMount() {
    // Component is now mounted and ready
  }

  componentWillUnmount() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    // Mode will be handled by onClose callback
  }

  private setupUpdateLoop() {
    this.updateInterval = window.setInterval(() => {
      if (Toxen.musicPlayer) {
        const currentTime = Toxen.musicPlayer.getTime();
        if (currentTime) {
          this.setState({
            currentTime,
            isPlaying: !Toxen.musicPlayer.paused
          });
        }
      }
    }, 50);
  }

  private async loadSubtitles() {
    if (this.props.song) {
      const subtitleFile = this.props.song.subtitleFile();
      if (subtitleFile) {
        try {
          const data = await this.props.song.readSubtitleFile();
          const type = toxenapi.getFileExtension(subtitleFile);
          const subtitles = SubtitleParser.parseByExtension(data, type);
          subtitles.song = this.props.song;
          this.setState({ subtitles });
        } catch (error) {
          Toxen.error(`Failed to load subtitles: ${error.message}`);
          this.setState({ subtitles: new SubtitleParser.SubtitleArray() });
        }
      } else {
        // Create new subtitle array for song
        const subtitles = new SubtitleParser.SubtitleArray();
        subtitles.song = this.props.song;
        subtitles.type = "tst"; // Default to TST format
        this.setState({ subtitles });
      }
    }
  }

  private markDirty() {
    if (!this.state.isDirty) {
      this.setState({ isDirty: true });
    }
  }

  private addSubtitleItem() {
    const { subtitles, currentTime } = this.state;
    const newItem: SubtitleParser.SubtitleItem = {
      id: subtitles.length + 1,
      start: new Time(currentTime.valueOf()),
      end: new Time(currentTime.valueOf() + 3000), // 3 seconds default
      text: "",
      options: {}
    };

    subtitles.push(newItem);
    subtitles.sort((a, b) => a.start.valueOf() - b.start.valueOf());
    
    // Reassign IDs
    subtitles.forEach((item, index) => {
      item.id = index + 1;
    });

    // Create new SubtitleArray to maintain type
    const newSubtitles = new SubtitleParser.SubtitleArray(...subtitles);
    newSubtitles.type = subtitles.type;
    newSubtitles.options = subtitles.options;
    newSubtitles.song = subtitles.song;
    
    this.setState({ 
      subtitles: newSubtitles,
      selectedItem: newItem,
      editingItem: newItem,
      newItemModal: false
    });
    this.markDirty();
  }

  private removeSubtitleItem(item: SubtitleParser.SubtitleItem) {
    const { subtitles } = this.state;
    const index = subtitles.indexOf(item);
    if (index > -1) {
      subtitles.splice(index, 1);
      // Reassign IDs
      subtitles.forEach((item, index) => {
        item.id = index + 1;
      });
      
      // Create new SubtitleArray to maintain type
      const newSubtitles = new SubtitleParser.SubtitleArray(...subtitles);
      newSubtitles.type = subtitles.type;
      newSubtitles.options = subtitles.options;
      newSubtitles.song = subtitles.song;
      
      this.setState({
        subtitles: newSubtitles,
        selectedItem: null,
        editingItem: null
      });
      this.markDirty();
    }
  }

  private updateSubtitleItem(item: SubtitleParser.SubtitleItem, updates: Partial<SubtitleParser.SubtitleItem>) {
    Object.assign(item, updates);
    
    // Create new SubtitleArray to maintain type
    const newSubtitles = new SubtitleParser.SubtitleArray(...this.state.subtitles);
    newSubtitles.type = this.state.subtitles.type;
    newSubtitles.options = this.state.subtitles.options;
    newSubtitles.song = this.state.subtitles.song;
    
    this.setState({ subtitles: newSubtitles });
    this.markDirty();
  }

  private seekToTime(time: Time) {
    if (Toxen.musicPlayer) {
      Toxen.musicPlayer.setPosition(time.toSeconds());
    }
  }

  private togglePlayback() {
    if (Toxen.musicPlayer) {
      if (this.state.isPlaying) {
        Toxen.musicPlayer.pause();
      } else {
        Toxen.musicPlayer.play();
      }
    }
  }

  private async saveSubtitles() {
    if (!this.props.song || !this.state.isDirty) return;

    try {
      const { subtitles } = this.state;
      const content = SubtitleParser.exportByExtension(subtitles, `.${subtitles.type}`);
      
      // Save to file system
      if (toxenapi.isDesktop()) {
        const subtitlePath = Toxen.cleanPath(this.props.song.subtitleFile() || 
          toxenapi.path.resolve(this.props.song.dirname(), `${this.props.song.getDisplayName()}.tst`));
        
        await toxenapi.fs.promises.writeFile(subtitlePath, content, 'utf8');
        
        // Update song paths if needed
        if (!this.props.song.paths.subtitles) {
          this.props.song.paths.subtitles = toxenapi.path.basename(subtitlePath);
          await this.props.song.saveInfo();
        }
      }

      this.setState({ isDirty: false });
      Toxen.log("Subtitles saved successfully");
      
      // Reload subtitles in the player
      await this.props.song.applySubtitles();
    } catch (error) {
      Toxen.error(`Failed to save subtitles: ${error.message}`);
    }
  }

  private async importSubtitles() {
    if (!toxenapi.isDesktop()) {
      Toxen.error("Import is only available in desktop mode");
      return;
    }

    try {
      const result = await toxenapi.remote.dialog.showOpenDialog({
        title: "Import Subtitles",
        filters: [
          { name: "Subtitle Files", extensions: ["srt", "tst", "lrc"] },
          { name: "All Files", extensions: ["*"] }
        ]
      });

      if (result.canceled || !result.filePaths.length) return;

      const filePath = result.filePaths[0];
      const content = await toxenapi.fs.promises.readFile(filePath, 'utf8');
      const type = toxenapi.getFileExtension(filePath);
      const subtitles = SubtitleParser.parseByExtension(content, type);
      subtitles.song = this.props.song;

      this.setState({ subtitles, selectedItem: null, editingItem: null });
      this.markDirty();
      Toxen.log("Subtitles imported successfully");
    } catch (error) {
      Toxen.error(`Failed to import subtitles: ${error.message}`);
    }
  }

  private async exportSubtitles() {
    if (!toxenapi.isDesktop()) {
      Toxen.error("Export is only available in desktop mode");
      return;
    }

    try {
      const { subtitles } = this.state;
      const defaultName = this.props.song ? 
        `${this.props.song.getDisplayName()}.${subtitles.type}` : 
        `subtitles.${subtitles.type}`;

      const result = await toxenapi.remote.dialog.showSaveDialog({
        title: "Export Subtitles",
        defaultPath: defaultName,
        filters: [
          { name: "TST Files", extensions: ["tst"] },
          { name: "SRT Files", extensions: ["srt"] },
          { name: "LRC Files", extensions: ["lrc"] }
        ]
      });

      if (result.canceled || !result.filePath) return;

      const type = toxenapi.getFileExtension(result.filePath);
      const content = SubtitleParser.exportByExtension(subtitles, type);
      await toxenapi.fs.promises.writeFile(result.filePath, content, 'utf8');
      
      Toxen.log("Subtitles exported successfully", 500);
    } catch (error) {
      Toxen.error(`Failed to export subtitles: ${error.message}`);
    }
  }

  private renderTimeline() {
    const { subtitles, currentTime, selectedItem } = this.state;
    const duration = Toxen.musicPlayer?.media?.duration ? new Time(Toxen.musicPlayer.media.duration * 1000) : new Time(180000); // 3 minutes fallback
    const timelineWidth = 800; // Fixed width for timeline
    
    return (
      <div className="subtitle-timeline" ref={this.timelineRef}>
        <div className="timeline-header">
          <span>Timeline</span>
          <span>{currentTime.toTimestamp()}</span>
        </div>
        
        <div className="timeline-track" style={{ width: timelineWidth }}>
          {/* Current time indicator */}
          <div 
            className="timeline-cursor"
            style={{ left: `${(currentTime.valueOf() / duration.valueOf()) * 100}%` }}
          />
          
          {/* Subtitle items */}
          {subtitles.map((item) => {
            const startPercent = (item.start.valueOf() / duration.valueOf()) * 100;
            const widthPercent = ((item.end.valueOf() - item.start.valueOf()) / duration.valueOf()) * 100;
            
            return (
              <div
                key={item.id}
                className={`timeline-item ${selectedItem === item ? 'selected' : ''}`}
                style={{
                  left: `${startPercent}%`,
                  width: `${Math.max(widthPercent, 1)}%`
                }}
                onClick={() => this.setState({ selectedItem: item })}
                onDoubleClick={() => this.setState({ editingItem: item })}
              >
                <div className="timeline-item-content">
                  {item.text.substring(0, 20)}{item.text.length > 20 ? '...' : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline scale */}
        <div className="timeline-scale">
          {Array.from({ length: 11 }, (_, i) => {
            const time = new Time((duration.valueOf() / 10) * i);
            return (
              <div
                key={i}
                className="timeline-scale-mark"
                style={{ left: `${i * 10}%` }}
                onClick={() => this.seekToTime(time)}
              >
                {time.toTimestamp()}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  private renderSubtitleList() {
    const { subtitles, selectedItem, editingItem } = this.state;
    
    return (
      <div className="subtitle-list">
        <div className="subtitle-list-header">
          <h3>Subtitle Lines ({subtitles.length})</h3>
          <div className="subtitle-list-actions">
            <Tooltip label="Add subtitle at current time">
              <ActionIcon onClick={() => this.addSubtitleItem()} size="sm">
                <IconPlus size={16} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
        
        <div className="subtitle-list-items">
          {subtitles.map((item) => (
            <div
              key={item.id}
              className={`subtitle-list-item ${selectedItem === item ? 'selected' : ''}`}
              onClick={() => this.setState({ selectedItem: item })}
            >
              <div className="subtitle-item-time">
                {item.start.toTimestamp()} - {item.end.toTimestamp()}
              </div>
              <div className="subtitle-item-text">
                {editingItem === item ? (
                  <TextInput
                    value={item.text}
                    onChange={(e) => this.updateSubtitleItem(item, { text: e.currentTarget.value })}
                    onBlur={() => this.setState({ editingItem: null })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        this.setState({ editingItem: null });
                      }
                      if (e.key === 'Escape') {
                        this.setState({ editingItem: null });
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    onDoubleClick={() => this.setState({ editingItem: item })}
                  >
                    {item.text || '<Empty>'}
                  </span>
                )}
              </div>
              <div className="subtitle-item-actions">
                <Tooltip label="Edit">
                  <ActionIcon
                    size="sm"
                    onClick={() => this.setState({ editingItem: item })}
                  >
                    <IconEdit size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Play from here">
                  <ActionIcon
                    size="sm"
                    onClick={() => this.seekToTime(item.start)}
                  >
                    <IconPlayerPlay size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Delete">
                  <ActionIcon
                    size="sm"
                    color="red"
                    onClick={() => this.removeSubtitleItem(item)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  private renderProperties() {
    const { selectedItem, subtitles } = this.state;
    
    if (!selectedItem) {
      return (
        <div className="subtitle-properties">
          <h3>Properties</h3>
          <p>Select a subtitle to edit its properties</p>
        </div>
      );
    }

    return (
      <div className="subtitle-properties">
        <h3>Properties</h3>
        
        <div className="property-group">
          <label>Text</label>
          <TextInput
            value={selectedItem.text}
            onChange={(e) => this.updateSubtitleItem(selectedItem, { text: e.currentTarget.value })}
            placeholder="Subtitle text..."
          />
        </div>

        <div className="property-group">
          <label>Start Time</label>
          <TextInput
            value={selectedItem.start.toTimestamp()}
            onChange={(e) => {
              try {
                const time = Time.fromTimestamp(e.currentTarget.value);
                this.updateSubtitleItem(selectedItem, { start: time });
              } catch {}
            }}
          />
        </div>

        <div className="property-group">
          <label>End Time</label>
          <TextInput
            value={selectedItem.end.toTimestamp()}
            onChange={(e) => {
              try {
                const time = Time.fromTimestamp(e.currentTarget.value);
                this.updateSubtitleItem(selectedItem, { end: time });
              } catch {}
            }}
          />
        </div>

        {subtitles.type === 'tst' && (
          <>
            <div className="property-group">
              <label>Font</label>
              <TextInput
                value={selectedItem.options.font || ''}
                onChange={(e) => this.updateSubtitleItem(selectedItem, {
                  options: { ...selectedItem.options, font: e.currentTarget.value }
                })}
                placeholder="Arial, sans-serif"
              />
            </div>

            <div className="property-group">
              <label>Font Size</label>
              <NumberInput
                value={parseInt(selectedItem.options.fontSize) || 24}
                onChange={(val) => this.updateSubtitleItem(selectedItem, {
                  options: { ...selectedItem.options, fontSize: val?.toString() || '24' }
                })}
                min={8}
                max={72}
              />
            </div>

            <div className="property-group">
              <label>Color</label>
              <TextInput
                value={selectedItem.options.color || ''}
                onChange={(e) => this.updateSubtitleItem(selectedItem, {
                  options: { ...selectedItem.options, color: e.currentTarget.value }
                })}
                placeholder="#ffffff"
              />
            </div>
          </>
        )}
      </div>
    );
  }

  render() {
    const { subtitles, isDirty, isPlaying } = this.state;
    
    return (
      <div className="subtitle-editor">
        <div className="subtitle-editor-header">
          <h2>Subtitle Editor</h2>
          <div className="subtitle-editor-info">
            {this.props.song && (
              <span>Editing: {this.props.song.getDisplayName()}</span>
            )}
            {isDirty && <span className="dirty-indicator">● Unsaved changes</span>}
          </div>
        </div>

        <div className="subtitle-editor-toolbar">
          <div className="toolbar-group">
            <Button
              leftSection={<IconUpload size={16} />}
              variant="light"
              size="sm"
              onClick={() => this.importSubtitles()}
            >
              Import
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              variant="light"
              size="sm"
              onClick={() => this.exportSubtitles()}
            >
              Export
            </Button>
          </div>

          <div className="toolbar-group">
            <Button
              leftSection={isPlaying ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
              variant="light"
              size="sm"
              onClick={() => this.togglePlayback()}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
          </div>

          <div className="toolbar-group">
            <Button
              leftSection={<IconCheck size={16} />}
              variant="filled"
              size="sm"
              disabled={!isDirty}
              onClick={() => this.saveSubtitles()}
            >
              Save
            </Button>
            <Button
              leftSection={<IconX size={16} />}
              variant="light"
              size="sm"
              onClick={this.props.onClose}
            >
              Close
            </Button>
          </div>
        </div>

        <div className="subtitle-editor-content">
          <div className="subtitle-editor-main">
            {this.renderTimeline()}
            {this.renderSubtitleList()}
          </div>
          <div className="subtitle-editor-sidebar">
            {this.renderProperties()}
          </div>
        </div>
      </div>
    );
  }
}
