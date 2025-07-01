import React, { useEffect, useState } from 'react';
import { Select, Group, Avatar, Text, Loader, Box, ActionIcon, Menu, Button, Stack } from '@mantine/core';
import { IconPhoto, IconX, IconFolderOpen, IconDots, IconTrash } from '@tabler/icons-react';
import { useModals } from '@mantine/modals';
import { Toxen } from '../../ToxenApp';
import './BackgroundFileSelector.scss';

interface BackgroundFileSelectorProps {
  label?: string;
  defaultValue?: string;
  onChange?: (value: string | null) => void;
  onDelete?: (fileName: string) => Promise<boolean>; // Returns true if deletion was successful
  // Directory source - provide either sourceDir OR getSourceDir function
  sourceDir?: string;
  getSourceDir?: () => string;
  // Custom copy destination logic (for playlist backgrounds)
  onCopyFile?: (sourceFile: string, fileName: string) => Promise<boolean>;
  // Description text for the selector
  description?: string;
}

interface BackgroundFileItem {
  value: string;
  label: string;
  imagePath?: string;
}

export default function BackgroundFileSelector({ 
  label = "Background file", 
  defaultValue, 
  onChange, 
  onDelete,
  sourceDir,
  getSourceDir,
  onCopyFile,
  description
}: BackgroundFileSelectorProps) {
  const [dataList, setDataList] = useState<BackgroundFileItem[]>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentValue, setCurrentValue] = useState<string | null>(defaultValue || null);
  const modals = useModals();

  // Get the directory to work with
  const getWorkingDir = () => {
    if (sourceDir) return sourceDir;
    if (getSourceDir) return getSourceDir();
    throw new Error('BackgroundFileSelector: Must provide sourceDir or getSourceDir');
  };

  useEffect(() => {
    const loadBackgroundFiles = async () => {
      try {
        await reloadFileList();
      } catch (error) {
        console.error('Failed to load background files:', error);
        setDataList([{ value: "<Empty>", label: "None" }]);
      } finally {
        setIsLoading(false);
      }
    };

    try {
      const workingDir = getWorkingDir();
      if (workingDir) {
        loadBackgroundFiles();
      }
    } catch (error) {
      console.error('BackgroundFileSelector configuration error:', error);
      setDataList([{ value: "<Empty>", label: "None" }]);
      setIsLoading(false);
    }
  }, [sourceDir]);

  // Update current value when defaultValue changes
  useEffect(() => {
    setCurrentValue(defaultValue || null);
  }, [defaultValue]);

  const handleDelete = async (fileName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent dropdown from selecting the item
    
    if (onDelete) {
      // Use custom delete callback
      const success = await onDelete(fileName);
      if (success) {
        await reloadFileList();
        // If we deleted the currently selected file, clear selection
        if (currentValue === fileName) {
          setCurrentValue(null);
          onChange?.(null);
        }
      }
    } else {
      // Default delete behavior with modal confirmation
      if (!toxenapi.isDesktop()) {
        Toxen.error('File deletion is only available in desktop version', 3000);
        return;
      }
      
      modals.openConfirmModal({
        title: 'Delete background image',
        children: (
          <Stack gap="md">
            <Text size="sm">
              Are you sure you want to delete <Text span fw={500}>"{fileName}"</Text>?
            </Text>
            <Text size="sm" c="dimmed">
              This action cannot be undone. The image file will be permanently removed from your song directory.
            </Text>
          </Stack>
        ),
        labels: { confirm: 'Delete image', cancel: 'Cancel' },
        confirmProps: { color: 'red', leftSection: <IconTrash size={16} /> },
        onConfirm: async () => {
          if (!toxenapi.isDesktop()) {
            Toxen.error('File operations are only available in desktop version', 3000);
            return;
          }
          
          try {
            const workingDir = getWorkingDir();
            const filePath = toxenapi.joinPath(workingDir, fileName);
            toxenapi.fs.unlinkSync(filePath);
            Toxen.log(`Background image deleted: ${fileName}`, 3000);
            
            await reloadFileList();
            // If we deleted the currently selected file, clear selection
            if (currentValue === fileName) {
              setCurrentValue(null);
              onChange?.(null);
            }
          } catch (error) {
            Toxen.error(`Failed to delete background image: ${error.message}`, 5000);
          }
        },
      });
    }
  };

  const reloadFileList = async () => {
    try {
      const workingDir = getWorkingDir();
      const supported = Toxen.getSupportedImageFiles();
      const files = await Toxen.filterSupportedFiles(workingDir, supported);
      
      const backgroundFiles: BackgroundFileItem[] = [
        { value: "<Empty>", label: "None" }
      ];

      for (const file of files) {
        const imagePath = toxenapi.isDesktop() 
          ? `file://${toxenapi.path.resolve(workingDir, file).replace(/\\/g, "/")}`
          : null;
        
        backgroundFiles.push({
          value: file,
          label: file,
          imagePath
        });
      }

      // Add browse option at the end
      backgroundFiles.push({
        value: "<Browse>",
        label: "Browse for new background..."
      });

      setDataList(backgroundFiles);
    } catch (error) {
      console.error('Failed to reload background files:', error);
    }
  };

  const handleChange = async (value: string | null) => {
    if (value === "<Browse>") {
      // Open file dialog for selecting a new background
      if (toxenapi.isDesktop()) {
        try {
          const result = await toxenapi.remote.dialog.showOpenDialog({
            title: 'Select Background Image',
            filters: [
              { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
            ],
            properties: ['openFile']
          });

          if (!result.canceled && result.filePaths.length > 0) {
            const selectedFile = result.filePaths[0];
            const fileName = toxenapi.path.basename(selectedFile);
            
            // Use custom copy logic if provided, otherwise use default
            let copySuccess = false;
            if (onCopyFile) {
              copySuccess = await onCopyFile(selectedFile, fileName);
            } else {
              // Default copy logic - ensure desktop mode
              if (!toxenapi.isDesktop()) {
                Toxen.error('File operations are only available in desktop version', 3000);
                return;
              }
              
              const workingDir = getWorkingDir();
              const targetPath = toxenapi.joinPath(workingDir, fileName);

              // Copy file to working directory if it's not already there
              if (selectedFile !== targetPath) {
                try {
                  toxenapi.fs.copyFileSync(selectedFile, targetPath);
                  Toxen.log(`Background image copied: ${fileName}`, 3000);
                  copySuccess = true;
                } catch (error) {
                  Toxen.error(`Failed to copy background image: ${error.message}`, 5000);
                  return;
                }
              } else {
                copySuccess = true;
              }
            }

            if (copySuccess) {
              // Reload the file list and select the new file
              await reloadFileList();
              
              // Select the newly added file
              setCurrentValue(fileName);
              onChange?.(fileName);
            }
          }
        } catch (error) {
          Toxen.error(`Failed to select background image: ${error.message}`, 5000);
        }
      } else {
        Toxen.error('File browsing is only available in desktop version', 3000);
      }
      return;
    }

    const actualValue = value === "<Empty>" ? null : value;
    setCurrentValue(actualValue);
    onChange?.(actualValue);
  };

  const renderSelectOption = ({ option }: { option: BackgroundFileItem }) => (
    <Group gap="sm" className={`background-file-option ${option.value === "<Browse>" ? "browse-option" : ""}`}>
      {option.value === "<Browse>" ? (
        <div className="background-file-preview">
          <IconFolderOpen size={20} className="background-file-icon browse" />
        </div>
      ) : option.imagePath ? (
        <div className="background-file-preview">
          <img 
            src={option.imagePath} 
            alt={option.label}
            className="background-file-image"
            onError={(e) => {
              // Fallback to icon if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <IconPhoto size={20} className="background-file-icon hidden" />
        </div>
      ) : (
        <div className="background-file-preview">
          {option.value === "<Empty>" ? (
            <IconX size={20} className="background-file-icon empty" />
          ) : (
            <IconPhoto size={20} className="background-file-icon" />
          )}
        </div>
      )}
      <div className="background-file-info">
        <Text size="sm" fw={option.value === "<Browse>" ? 600 : 500}>
          {option.value === "<Empty>" ? "No background" : option.label}
        </Text>
        {option.value === "<Browse>" ? (
          <Text size="xs" c="dimmed">
            Select from file system
          </Text>
        ) : option.value !== "<Empty>" && (
          <Text size="xs" c="dimmed">
            Image file
          </Text>
        )}
      </div>
      {/* Options button for actual image files */}
      {option.value !== "<Empty>" && option.value !== "<Browse>" && (
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          className="background-file-options"
          onClick={(e) => {
            e.stopPropagation();
            modals.openModal({
              title: `Background Image Options`,
              children: (
                <Stack gap="md">
                  <Group gap="sm">
                    {option.imagePath && (
                      <div className="background-file-preview">
                        <img 
                          src={option.imagePath} 
                          alt={option.label}
                          className="background-file-image"
                        />
                      </div>
                    )}
                    <div>
                      <Text fw={500}>{option.label}</Text>
                      <Text size="sm" c="dimmed">Image file</Text>
                    </div>
                  </Group>
                  
                  <Button
                    leftSection={<IconTrash size={16} />}
                    color="red"
                    variant="light"
                    fullWidth
                    onClick={(e) => {
                      modals.closeAll();
                      handleDelete(option.value, e);
                    }}
                  >
                    Delete image
                  </Button>
                </Stack>
              ),
            });
          }}
        >
          <IconDots size={14} />
        </ActionIcon>
      )}
    </Group>
  );

  const renderSelectedOption = (value: string) => {
    const selectedItem = dataList?.find(item => item.value === value);
    if (!selectedItem) return value;

    return (
      <Group gap="sm" className="background-file-selected">
        {selectedItem.imagePath ? (
          <div className="background-file-preview small">
            <img 
              src={selectedItem.imagePath} 
              alt={selectedItem.label}
              className="background-file-image"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <IconPhoto size={16} className="background-file-icon hidden" />
          </div>
        ) : (
          <div className="background-file-preview small">
            {selectedItem.value === "<Empty>" ? (
              <IconX size={16} className="background-file-icon empty" />
            ) : (
              <IconPhoto size={16} className="background-file-icon" />
            )}
          </div>
        )}
        <Text size="sm">
          {selectedItem.value === "<Empty>" ? "No background" : selectedItem.label}
        </Text>
      </Group>
    );
  };

  const getCurrentPreview = () => {
    if (!currentValue || currentValue === "<Empty>") {
      return (
        <div className="background-selector-preview no-background">
          <IconX size={24} className="background-file-icon empty" />
        </div>
      );
    }

    const currentItem = dataList?.find(item => item.value === currentValue);
    if (currentItem?.imagePath) {
      return (
        <div className="background-selector-preview">
          <img 
            src={currentItem.imagePath}
            alt={currentItem.label}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div className="background-file-preview-fallback" style={{ display: 'none' }}>
            <IconPhoto size={24} className="background-file-icon" />
          </div>
        </div>
      );
    }

    return (
      <div className="background-selector-preview no-image">
        <IconPhoto size={24} className="background-file-icon" />
      </div>
    );
  };

  if (isLoading || dataList === null) {
    return (
      <Box>
        <Text size="sm" fw={500} mb={5}>{label}</Text>
        <Group gap="sm">
          <div className="background-selector-preview loading">
            <Loader size="sm" />
          </div>
          <Loader size="sm" />
        </Group>
      </Box>
    );
  }

  return (
    <div>
      <Text size="sm" fw={500} mb={5}>{label}</Text>
      <Group gap="md" align="flex-start">
        {getCurrentPreview()}
        <div style={{ flex: 1 }}>
          <Select
            data={dataList.map(item => ({
              value: item.value,
              label: item.label,
              ...item
            }))}
            value={currentValue}
            onChange={handleChange}
            renderOption={renderSelectOption}
            maxDropdownHeight={300}
            searchable
            clearable={false}
            allowDeselect={false}
            filter={({ options, search }) => {
              if (!search) return options;
              return options.filter((option: any) => {
                // Always show the browse option
                if (option.value === "<Browse>") return true;
                return option.label.toLowerCase().includes(search.toLowerCase().trim());
              });
            }}
          />
        </div>
      </Group>
      {description && (
        <Text size="sm" c="dimmed" mt={4}>
          {description}
        </Text>
      )}
    </div>
  );
}
