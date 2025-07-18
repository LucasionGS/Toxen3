/**
 * Custom Philips Hue API implementation for Toxen
 * Built from the ground up to avoid third-party library compatibility issues
 */

import * as dgram from 'dgram';
import * as crypto from 'crypto';
import { dtls } from 'node-dtls-client';

export interface HueBridgeDevice {
  id: string;
  internalipaddress: string;
  port?: number;
}

export interface HueCredentials {
  username: string;
  clientkey: string;
}

export interface HueRegistrationResponse {
  username: string;
  clientkey: string;
}

export interface HuePosition {
  x: number;
  y: number;
  z: number;
}

export interface HueResourceNode {
  rid: string;
  rtype: string;
}

export interface HueEntertainmentChannel {
  channel_id: number;
  position: HuePosition;
  members: Array<{
    index: number;
    service: HueResourceNode;
  }>;
}

export interface HueServiceLocation {
  position: HuePosition;
  positions: HuePosition[];
  service: HueResourceNode;
}

export interface HueEntertainmentArea {
  id: string;
  type: string;
  name: string;
  metadata: {
    name: string;
  };
  channels: HueEntertainmentChannel[];
  configuration_type: string;
  light_services: HueResourceNode[];
  locations: {
    service_locations: HueServiceLocation[];
  };
  status: 'active' | 'inactive';
  stream_proxy: {
    mode: string;
    node: HueResourceNode;
  };
}

export interface HueLight {
  id: string;
  type: string;
  metadata: {
    name: string;
  };
  on: {
    on: boolean;
  };
  dimming: {
    brightness: number;
  };
  color?: {
    xy: {
      x: number;
      y: number;
    };
  };
  color_temperature?: {
    mirek: number;
  };
}

export interface HueApiResponse<T> {
  errors?: Array<{
    description: string;
  }>;
  data?: T;
}

/**
 * DTLS Client for Hue Entertainment API using node-dtls-client
 * Implements robust DTLS handshake and encryption for Hue Entertainment streaming
 */
class HueDTLSClient {
  private dtlsSocket: dtls.Socket = null;
  private isConnected = false;
  private readonly bridgeIp: string;
  private readonly credentials: HueCredentials;
  private readonly entertainmentAreaId: string;
  private abortionController: AbortController | null = null;
  private applicationId: string | null = null;

  constructor(bridgeIp: string, credentials: HueCredentials, entertainmentAreaId: string, applicationId?: string) {
    this.bridgeIp = bridgeIp;
    this.credentials = credentials;
    this.entertainmentAreaId = entertainmentAreaId;
    this.applicationId = applicationId || credentials.username; // Fallback to username
  }

  async connect(timeout = 5000): Promise<void> {
    console.log(`Establishing DTLS connection to ${this.bridgeIp}:2100...`);
    console.log(`Using PSK identity (hue-application-id): ${this.applicationId}`);
    console.log(`Using PSK (clientkey): ${this.credentials.clientkey.substring(0, 8)}...`);

    // Create abort controller for connection management
    this.abortionController = new AbortController();

    // Follow official Hue Entertainment API documentation
    // PSK identity = hue-application-id
    // PSK = 16-byte binary representation of the 32-character hex clientkey
    const dtlsOptions = {
      timeout,
      port: 2100,
      type: 'udp4',
      address: this.bridgeIp,
      signal: this.abortionController.signal,
      ciphers: ["TLS_PSK_WITH_AES_128_GCM_SHA256"],
      psk: {
        [this.applicationId]: Buffer.from(
          this.credentials.clientkey,
          "hex"
        ),
      },
    } as unknown as dtls.Options;

    console.log('Creating DTLS socket with options:', {
      ...dtlsOptions,
      // psk: '[REDACTED]',
      signal: '[AbortController.signal]'
    });

    this.dtlsSocket = dtls.createSocket(dtlsOptions);

    // Set up event handlers like the working implementation
    this.dtlsSocket.on('error', (error: Error) => {
      console.error('DTLS socket error:', error);
      this.isConnected = false;
    });

    this.dtlsSocket.on('message', (msg: Buffer) => {
      console.log(`Received DTLS message: ${msg.length} bytes`);
    });

    this.dtlsSocket.on('close', () => {
      console.log('DTLS connection closed');
      this.isConnected = false;
    });

    // Return a Promise that resolves on connection with proper error handling
    return new Promise((resolve, reject) => {
      // Set up timeout handler
      const timeoutHandler = setTimeout(() => {
        console.error(`DTLS connection timeout after ${timeout}ms`);
        this.disconnect();
        reject(new Error(`DTLS handshake timed out after ${timeout}ms`));
      }, timeout + 1000); // Give extra time beyond the DTLS timeout

      this.dtlsSocket.on("connected", () => {
        clearTimeout(timeoutHandler);
        this.isConnected = true;
        console.log('DTLS connection established successfully!');
        resolve();
      });

      this.dtlsSocket.on("error", (error: Error) => {
        clearTimeout(timeoutHandler);
        console.error('DTLS socket error during connection:', error);
        this.isConnected = false;
        reject(error);
      });
    });
  }

  disconnect(): void {
    if (!this.dtlsSocket) {
      console.log('No DTLS socket to disconnect');
      return;
    }

    // Exactly like the working implementation from jdmg94/Hue-Sync
    this.dtlsSocket.on("close", () => {
      console.log('DTLS socket closed successfully');
    });

    if (this.abortionController) {
      this.abortionController.abort();
    }
    
    this.abortionController = null;
    this.dtlsSocket = null;
    this.isConnected = false;
    console.log('DTLS connection disconnected');
  }

  sendLightData(lightColors: Array<[number, number, number]>): void {
    if (!this.dtlsSocket || !this.isConnected) {
      throw new Error('No active datagram socket!');
    }

    // Create HueStream protocol message exactly like working implementation
    const hueStreamMessage = this.createHueStreamMessage(lightColors);
    
    console.log(`Sending HueStream message via DTLS: ${hueStreamMessage.length} bytes`);
    
    try {
      this.dtlsSocket.send(hueStreamMessage);
      console.log('HueStream message sent successfully via DTLS');
    } catch (error) {
      console.error('Failed to send HueStream message:', error);
      throw error;
    }
  }

  private createHueStreamMessage(lightColors: Array<[number, number, number]>): Buffer {
    // Official Hue Entertainment API message format
    // Protocol uses big (network) endianness
    
    // Header (16 bytes total)
    const protocol = Buffer.from("HueStream");        // 9 bytes: Protocol name
    const version = Buffer.from([0x02, 0x00]);        // 2 bytes: Version 2.0 (major.minor)
    const sequenceNumber = Buffer.from([0x00]);       // 1 byte: Sequence ID (ignored by bridge)
    const reserved1 = Buffer.from([0x00, 0x00]);      // 2 bytes: Reserved (zeros)
    const colorSpace = Buffer.from([0x00]);           // 1 byte: 0x00 = RGB, 0x01 = XY+Brightness  
    const reserved2 = Buffer.from([0x00]);            // 1 byte: Reserved (zeros)
    
    // Entertainment configuration ID (36 bytes) - full UUID string as per spec
    const entertainmentConfigId = Buffer.from(this.entertainmentAreaId.padEnd(36, '\0'), 'ascii');
    
    console.log(`Creating HueStream message for ${lightColors.length} lights`);
    console.log(`Entertainment area ID: ${this.entertainmentAreaId}`);
    console.log(`Entertainment config ID buffer: ${entertainmentConfigId.length} bytes`);
    
    // Channel data: each channel uses 7 bytes (1 byte ID + 6 bytes RGB16 values)
    // RGB values are 16-bit per component (2 bytes each)
    const channelData = lightColors.map((rgb, channelIndex) => {
      const channelId = Buffer.from([channelIndex]);           // 1 byte: Channel ID
      const red = Buffer.from([rgb[0], rgb[0]]);               // 2 bytes: Red 16-bit
      const green = Buffer.from([rgb[1], rgb[1]]);             // 2 bytes: Green 16-bit  
      const blue = Buffer.from([rgb[2], rgb[2]]);              // 2 bytes: Blue 16-bit
      
      return Buffer.concat([channelId, red, green, blue] as any);     // 7 bytes total per channel
    });

    // Assemble complete message according to official specification
    const message = Buffer.concat([
      protocol,              // 9 bytes
      version,               // 2 bytes  
      sequenceNumber,        // 1 byte
      reserved1,             // 2 bytes
      colorSpace,            // 1 byte
      reserved2,             // 1 byte
      entertainmentConfigId, // 36 bytes
      ...channelData,        // 7 bytes per channel
    ] as any);
    
    console.log(`HueStream message assembled: ${message.length} bytes (header: 52, channels: ${channelData.length * 7})`);
    console.log(`Message format validation:`);
    console.log(`  - Protocol: ${message.subarray(0, 9).toString()}`);
    console.log(`  - Version: ${message[9]}.${message[10]}`);
    console.log(`  - Entertainment ID: ${message.subarray(16, 52).toString('ascii').replace(/\0+$/, '')}`);
    console.log(`  - Channels: ${channelData.length}`);
    console.log(`Message content (hex): ${message.toString('hex')}`);
    return message;
  }

}

/**
 * Main Hue API class
 */
export class HueAPI {
  private bridgeIp: string;
  private credentials: HueCredentials | null = null;
  private dtlsClient: HueDTLSClient | null = null;
  private currentEntertainmentArea: HueEntertainmentArea | null = null;

  constructor(bridgeIp: string) {
    this.bridgeIp = bridgeIp;
  }

  /**
   * Discover Hue bridges on the network
   */
  static async discover(): Promise<HueBridgeDevice[]> {
    try {
      console.log('Discovering Hue bridges via Philips discovery API...');
      
      const response = await fetch('https://discovery.meethue.com/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Discovery failed: ${response.status} ${response.statusText}`);
      }

      const bridges = await response.json() as HueBridgeDevice[];
      console.log(`Found ${bridges.length} Hue bridge(s)`);
      
      return bridges;
    } catch (error) {
      console.error('Bridge discovery failed:', error);
      throw error;
    }
  }

  /**
   * Register with a Hue bridge to get credentials
   */
  static async register(bridgeIp: string, deviceType = 'toxen-music-player'): Promise<HueRegistrationResponse> {
    const endpoint = `http://${bridgeIp}/api`;
    
    const requestBody = {
      devicetype: deviceType,
      generateclientkey: true
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Registration request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        
        if (result.error) {
          throw new Error(result.error.description || 'Registration failed');
        }
        
        if (result.success) {
          return {
            username: result.success.username,
            clientkey: result.success.clientkey
          };
        }
      }
      
      throw new Error('Unexpected response format from bridge');
    } catch (error) {
      console.error('Bridge registration failed:', error);
      throw error;
    }
  }

  /**
   * Set credentials for API access
   */
  setCredentials(credentials: HueCredentials): void {
    this.credentials = credentials;
  }

  /**
   * Make an authenticated API request
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.credentials) {
      throw new Error('No credentials set. Call setCredentials() first.');
    }

    const url = `https://${this.bridgeIp}${endpoint}`;
    
    const defaultHeaders = {
      'hue-application-key': this.credentials.username,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as HueApiResponse<T>;

    console.log(`API response for ${endpoint}:`, data);
    
    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0].description);
    }

    if (data.data === undefined) {
      throw new Error('No data in API response');
    }

    return data.data;
  }

  /**
   * Get all entertainment areas
   */
  async getEntertainmentAreas(): Promise<HueEntertainmentArea[]> {
    return this.makeRequest<HueEntertainmentArea[]>('/clip/v2/resource/entertainment_configuration');
  }

  /**
   * Get a specific entertainment area
   */
  async getEntertainmentArea(id: string): Promise<HueEntertainmentArea> {
    const areas = await this.makeRequest<HueEntertainmentArea[]>(`/clip/v2/resource/entertainment_configuration/${id}`);
    if (!areas || areas.length === 0) {
      throw new Error(`Entertainment area ${id} not found`);
    }
    return areas[0];
  }

  /**
   * Get all lights
   */
  async getLights(): Promise<HueLight[]> {
    return this.makeRequest<HueLight[]>('/clip/v2/resource/light');
  }

  /**
   * Get a specific light
   */
  async getLight(id: string): Promise<HueLight> {
    const lights = await this.makeRequest<HueLight[]>(`/clip/v2/resource/light/${id}`);
    if (!lights || lights.length === 0) {
      throw new Error(`Light ${id} not found`);
    }
    return lights[0];
  }

  /**
   * Update a light's state
   */
  async updateLight(id: string, state: Partial<HueLight>): Promise<void> {
    await this.makeRequest(`/clip/v2/resource/light/${id}`, {
      method: 'PUT',
      body: JSON.stringify(state)
    });
  }

  /**
   * Start entertainment streaming for an area
   * Following the official Hue Entertainment API specification
   */
  async startEntertainment(entertainmentArea: HueEntertainmentArea, timeout: number = 5000): Promise<void> {
    if (!this.credentials) {
      throw new Error('No credentials set');
    }

    console.log(`Starting entertainment for area: ${entertainmentArea.id} (${entertainmentArea.name})`);

    try {
      // Store the current entertainment area first
      this.currentEntertainmentArea = entertainmentArea;

      // Get the hue-application-id for proper PSK identity
      console.log('Retrieving hue-application-id...');
      const applicationId = await this.getApplicationId();

      // First, activate the entertainment area via REST API
      console.log('Activating entertainment area via REST API...');
      await this.makeRequest(`/clip/v2/resource/entertainment_configuration/${entertainmentArea.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'start'
        })
      });

      console.log('Entertainment area activated, immediately establishing DTLS connection...');

      // Create DTLS client for streaming with proper application ID
      // CRITICAL: Connect immediately while port 2100 is still open
      this.dtlsClient = new HueDTLSClient(this.bridgeIp, this.credentials, entertainmentArea.id, applicationId);
      
      // No delay - connect immediately
      await this.dtlsClient.connect(timeout);
      
      console.log(`Entertainment streaming started for area: ${entertainmentArea.name}`);
    } catch (error) {
      console.error('Failed to start entertainment:', error);
      this.currentEntertainmentArea = null;
      if (this.dtlsClient) {
        this.dtlsClient.disconnect();
        this.dtlsClient = null;
      }
      throw error;
    }
  }

  /**
   * Stop entertainment streaming
   * Exactly matching the working jdmg94/Hue-Sync implementation
   */
  async stopEntertainment(): Promise<void> {
    if (!this.dtlsClient) {
      console.log('No active DTLS socket to stop');
      return;
    }

    const entertainmentAreaId = this.currentEntertainmentArea?.id;
    
    // Set up close handler before disconnecting (like working implementation)
    this.dtlsClient.disconnect();
    this.dtlsClient = null;

    // Stop the entertainment area after closing the DTLS connection
    if (entertainmentAreaId) {
      try {
        await this.makeRequest(`/clip/v2/resource/entertainment_configuration/${entertainmentAreaId}`, {
          method: 'PUT',
          body: JSON.stringify({
            action: 'stop'
          })
        });
        console.log('Entertainment area stopped via REST API');
      } catch (error) {
        console.warn('Failed to stop entertainment area via REST API:', error);
      }
    }
    
    this.currentEntertainmentArea = null;
    console.log('Entertainment streaming stopped');
  }

  /**
   * Send light color data via entertainment streaming
   * Exactly matching the working jdmg94/Hue-Sync transition method
   */
  sendLightColors(colors: Array<[number, number, number]>): void {
    if (!this.dtlsClient) {
      throw new Error('No active datagram socket!');
    }

    this.dtlsClient.sendLightData(colors);
  }

  /**
   * Check if entertainment streaming is active
   */
  isStreamingActive(): boolean {
    return !!this.dtlsClient && !!this.currentEntertainmentArea;
  }

  /**
   * Get the current entertainment area
   */
  getCurrentEntertainmentArea(): HueEntertainmentArea | null {
    return this.currentEntertainmentArea;
  }

  /**
   * Get bridge info and check entertainment API support
   */
  async getBridgeInfo(): Promise<any> {
    const config = await this.makeRequest('/api/0/config');
    
    // Check if bridge supports entertainment API
    const swversion = (config as any).swversion;
    const apiversion = (config as any).apiversion;
    
    console.log(`Bridge firmware: ${swversion}, API version: ${apiversion}`);
    
    // Entertainment API requires firmware 1948086000 or newer
    if (swversion && parseInt(swversion) >= 1948086000) {
      console.log('✅ Bridge supports Entertainment API');
    } else {
      console.log('❌ Bridge may not support Entertainment API (firmware too old)');
    }
    
    return config;
  }

  /**
   * Test connection to bridge
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getBridgeInfo();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Test DTLS entertainment streaming with sample colors
   * Now using the official Hue Entertainment API specification
   */
  async testEntertainmentStreaming(entertainmentArea: HueEntertainmentArea, duration = 5000): Promise<boolean> {
    try {
      console.log(`Testing entertainment streaming for area ${entertainmentArea.id}...`);
      
      // Start entertainment streaming
      await this.startEntertainment(entertainmentArea);
      
      // Send some test colors (RGB values 0-255)
      const testColors: Array<[number, number, number]> = [
        [255, 0, 0],   // Red
        [0, 255, 0],   // Green
        [0, 0, 255],   // Blue
        [255, 255, 0], // Yellow
        [255, 0, 255], // Magenta
        [0, 255, 255]  // Cyan
      ];
      
      console.log('Starting test color sequence...');
      let colorIndex = 0;
      const interval = setInterval(() => {
        try {
          // Cycle through test colors for all channels
          const currentColor = testColors[colorIndex % testColors.length];
          const currentColors = new Array(Math.min(entertainmentArea.channels?.length || 6, 6)).fill(currentColor);
          
          this.sendLightColors(currentColors);
          console.log(`Sent test color to ${currentColors.length} channels: RGB(${currentColor.join(', ')})`);
          colorIndex++;
        } catch (error) {
          console.error('Failed to send test color:', error);
        }
      }, 1000);
      
      // Stop after duration
      setTimeout(() => {
        clearInterval(interval);
        console.log('Stopping entertainment streaming test...');
        this.stopEntertainment().catch((error: Error) => {
          console.error('Failed to stop streaming:', error);
        });
      }, duration);
      
      console.log(`Entertainment streaming test started for ${duration}ms`);
      return true;
      
    } catch (error) {
      console.error('Entertainment streaming test failed:', error);
      return false;
    }
  }

  /**
   * Test if entertainment area activation opens DTLS port
   */
  async testEntertainmentActivation(entertainmentArea: HueEntertainmentArea): Promise<boolean> {
    try {
      console.log('Testing entertainment area activation...');
      
      // Activate the entertainment area
      await this.makeRequest(`/clip/v2/resource/entertainment_configuration/${entertainmentArea.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'start'
        })
      });
      
      console.log('Entertainment area activated. Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test if port is now open using a simple UDP socket
      const testResult = await this.testUDPPort2100();
      
      // Stop the entertainment area
      await this.makeRequest(`/clip/v2/resource/entertainment_configuration/${entertainmentArea.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'stop'
        })
      });
      
      return testResult;
    } catch (error) {
      console.error('Entertainment activation test failed:', error);
      return false;
    }
  }

  /**
   * Test if UDP port 2100 is open/responding
   */
  private testUDPPort2100(): Promise<boolean> {
    return new Promise((resolve) => {
      const testSocket = dgram.createSocket('udp4');
      const testMessage = new Uint8Array([0x01, 0x02, 0x03, 0x04]); // Simple test packet
      
      const timeout = setTimeout(() => {
        testSocket.close();
        console.log('UDP port 2100 test: timeout (port likely closed)');
        resolve(false);
      }, 3000);
      
      testSocket.on('error', (error) => {
        clearTimeout(timeout);
        testSocket.close();
        console.log('UDP port 2100 test: error', error.message);
        resolve(false);
      });
      
      testSocket.on('message', (msg) => {
        clearTimeout(timeout);
        testSocket.close();
        console.log('UDP port 2100 test: received response (port is open)');
        resolve(true);
      });
      
      testSocket.send(testMessage, 2100, this.bridgeIp, (error) => {
        if (error) {
          clearTimeout(timeout);
          testSocket.close();
          console.log('UDP port 2100 test: send failed', error.message);
          resolve(false);
        } else {
          console.log('UDP port 2100 test: packet sent, waiting for response...');
        }
      });
    });
  }

  /**
   * Get the hue-application-id for DTLS PSK identity
   */
  async getApplicationId(): Promise<string> {
    if (!this.credentials) {
      throw new Error('No credentials set. Call setCredentials() first.');
    }

    try {
      const response = await fetch(`https://${this.bridgeIp}/auth/v1`, {
        method: 'GET',
        headers: {
          'hue-application-key': this.credentials.username
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get application ID: ${response.status} ${response.statusText}`);
      }

      const appId = response.headers.get('hue-application-id');
      if (!appId) {
        throw new Error('No hue-application-id header in response');
      }

      console.log(`Retrieved hue-application-id: ${appId}`);
      return appId;
    } catch (error) {
      console.error('Failed to get application ID:', error);
      // Fallback to username if we can't get the application ID
      console.log('Falling back to username as PSK identity');
      return this.credentials.username;
    }
  }

  /**
   * Quick test: Activate entertainment area and immediately test DTLS
   */
  async quickDTLSTest(entertainmentArea: HueEntertainmentArea): Promise<boolean> {
    try {
      console.log('🧪 Quick DTLS test starting...');
      
      // Get application ID first
      const applicationId = await this.getApplicationId();
      console.log(`Using application ID: ${applicationId}`);
      
      // Activate entertainment area
      console.log('Activating entertainment area...');
      await this.makeRequest(`/clip/v2/resource/entertainment_configuration/${entertainmentArea.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'start'
        })
      });
      
      console.log('✅ Entertainment area activated, testing DTLS immediately...');
      
      // Create DTLS client and connect immediately
      const testDtlsClient = new HueDTLSClient(this.bridgeIp, this.credentials!, entertainmentArea.id, applicationId);
      
      try {
        await testDtlsClient.connect(3000);
        console.log('🎉 DTLS connection successful!');
        
        // Send a test message
        testDtlsClient.sendLightData([[255, 0, 0]]); // Red test
        console.log('📤 Sent test light data');
        
        // Clean up
        testDtlsClient.disconnect();
        
        return true;
      } catch (dtlsError) {
        console.error('❌ DTLS connection failed:', dtlsError);
        testDtlsClient.disconnect();
        return false;
      } finally {
        // Stop entertainment area
        try {
          await this.makeRequest(`/clip/v2/resource/entertainment_configuration/${entertainmentArea.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              action: 'stop'
            })
          });
          console.log('Entertainment area stopped');
        } catch (stopError) {
          console.warn('Failed to stop entertainment area:', stopError);
        }
      }
    } catch (error) {
      console.error('Quick DTLS test failed:', error);
      return false;
    }
  }
}

export default HueAPI;
