/**
 * ImageCache - Utility for caching resized images for better performance
 * 
 * This class provides functionality to:
 * - Resize large background images to smaller thumbnails
 * - Cache the resized images in memory and optionally on disk
 * - Automatically invalidate cache when source images change
 */

interface CacheEntry {
  url: string;
  originalPath: string;
  hash: string;
  lastModified?: number;
  size: { width: number; height: number };
}

export default class ImageCache {
  private static instance: ImageCache;
  private cache = new Map<string, CacheEntry>();
  private readonly defaultThumbnailSize = { width: 160, height: 90 }; // 16:9 aspect ratio for thumbnails
  
  public static getInstance(): ImageCache {
    if (!ImageCache.instance) {
      ImageCache.instance = new ImageCache();
    }
    return ImageCache.instance;
  }

  /**
   * Get a cached thumbnail URL for the given image path
   * @param imagePath - Full path to the original image
   * @param hash - Optional hash for cache invalidation
   * @param size - Optional custom size for the thumbnail
   * @returns Promise that resolves to the thumbnail URL
   */
  public async getThumbnail(
    imagePath: string, 
    hash?: string, 
    size: { width: number; height: number } = this.defaultThumbnailSize
  ): Promise<string | null> {
    if (!imagePath) return null;

    const cacheKey = this.getCacheKey(imagePath, size);
    const cached = this.cache.get(cacheKey);

    // Check if we have a valid cached entry
    if (cached && cached.hash === hash) {
      return cached.url;
    }

    // Create new thumbnail
    try {
      const thumbnailUrl = await this.createThumbnail(imagePath, size);
      
      if (thumbnailUrl) {
        this.cache.set(cacheKey, {
          url: thumbnailUrl,
          originalPath: imagePath,
          hash: hash || '',
          size,
          lastModified: Date.now()
        });
      }
      
      return thumbnailUrl;
    } catch (error) {
      console.warn('Failed to create thumbnail for:', imagePath, error);
      return null;
    }
  }

  /**
   * Create a resized thumbnail using Canvas API
   * @param imagePath - Path to the original image
   * @param size - Target size for the thumbnail
   * @returns Promise that resolves to the thumbnail data URL
   */
  private async createThumbnail(
    imagePath: string, 
    size: { width: number; height: number }
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          canvas.width = size.width;
          canvas.height = size.height;

          // Calculate scaling to cover the thumbnail area (like CSS object-fit: cover)
          const imgAspect = img.width / img.height;
          const thumbAspect = size.width / size.height;
          
          let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;
          
          if (imgAspect > thumbAspect) {
            // Image is wider than thumbnail - crop horizontally
            sourceWidth = img.height * thumbAspect;
            sourceX = (img.width - sourceWidth) / 2;
          } else {
            // Image is taller than thumbnail - crop vertically
            sourceHeight = img.width / thumbAspect;
            sourceY = (img.height - sourceHeight) / 2;
          }

          // Draw the resized image
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, size.width, size.height
          );

          // Convert to data URL with reasonable quality
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(thumbnailUrl);
          
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${imagePath}`));
      };

      // Handle different path formats (file://, http://, etc.)
      img.src = imagePath;
    });
  }

  /**
   * Invalidate cache entries for a specific image path
   * @param imagePath - Path of the image to invalidate
   */
  public invalidate(imagePath: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.originalPath === imagePath) {
        keysToDelete.push(key);
        
        // Revoke object URL if it's a blob URL to free memory
        if (entry.url.startsWith('blob:')) {
          URL.revokeObjectURL(entry.url);
        }
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cached thumbnails
   */
  public clearAll(): void {
    // Revoke all blob URLs to free memory
    for (const entry of this.cache.values()) {
      if (entry.url.startsWith('blob:')) {
        URL.revokeObjectURL(entry.url);
      }
    }
    
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  public getStats(): { 
    totalEntries: number; 
    totalSize: number; 
    entries: Array<{ path: string; size: string; age: string }> 
  } {
    const entries: Array<{ path: string; size: string; age: string }> = [];
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      const size = entry.url.length; // Rough estimate for data URLs
      totalSize += size;
      
      entries.push({
        path: entry.originalPath,
        size: `${(size / 1024).toFixed(1)} KB`,
        age: `${((Date.now() - (entry.lastModified || 0)) / 1000).toFixed(0)}s`
      });
    }
    
    return {
      totalEntries: this.cache.size,
      totalSize,
      entries
    };
  }

  /**
   * Generate a cache key for the given parameters
   */
  private getCacheKey(imagePath: string, size: { width: number; height: number }): string {
    return `${imagePath}|${size.width}x${size.height}`;
  }

  /**
   * Clean up old cache entries (called periodically)
   * @param maxAge - Maximum age in milliseconds (default: 1 hour)
   */
  public cleanup(maxAge: number = 60 * 60 * 1000): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastModified && (now - entry.lastModified) > maxAge) {
        keysToDelete.push(key);
        
        if (entry.url.startsWith('blob:')) {
          URL.revokeObjectURL(entry.url);
        }
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}
