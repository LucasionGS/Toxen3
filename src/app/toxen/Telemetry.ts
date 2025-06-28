namespace Telemetry {
  const batch: TelemetryEvent[] = [];
  const batchSize = 10;

  export function log(type: TelemetryEventType, data: Record<string, any> = {}) {
    const event = new TelemetryEvent(type, data);
    batch.push(event);
    if (batch.length >= batchSize) {
      sendBatch();
    }
  }
  
  export function logEvent(event: TelemetryEvent) {
    batch.push(event);
    if (batch.length >= batchSize) {
      sendBatch();
    }
  }

  export function sendBatch() {
    if (batch.length === 0) {
      return;
    }
    const batchToSend = [...batch];
    batch.length = 0; // Clear the batch
    // Send the batch to the server
    fetch("https://telemetry.toxen.net", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: "*", // TODO: Figure out a user identifier that is still anonymous
        events: batchToSend,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          console.error("Failed to send telemetry data");
        }
      })
      .catch((error) => {
        console.error("Error sending telemetry data:", error);
      });
  }

  export function flush() {
    if (batch.length > 0) {
      sendBatch();
    }
  }
}

export default Telemetry;

export enum TelemetryEventType {
  // User events
  USER_LOGIN = "user_login",
  USER_LOGOUT = "user_logout",
  USER_REGISTER = "user_register",
  USER_PROFILE_UPDATE = "user_profile_update",

  // Application events
  APP_START = "app_start",
  APP_STOP = "app_stop",
  APP_ERROR = "app_error",

  // Feature usage
  FEATURE_X_USED = "feature_x_used",
  FEATURE_Y_USED = "feature_y_used",

  // Performance metrics
  STARTUP_LOAD_TIME = "startup_load_time",
};

export class TelemetryEvent {
  constructor(
    public type: TelemetryEventType,
    public data: Record<string, any> = {},
    public timestamp: Date = new Date()
  ) {}
}