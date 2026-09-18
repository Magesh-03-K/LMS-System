/**
 * ==============================================================================
 * Production SRE Observability & Telemetry Engine
 * CloudWatch EMF (Embedded Metric Format) | Sensitive Data Redaction | Workflow Tracing
 * ==============================================================================
 */

export type WorkflowType =
  | 'ATTENDANCE_MARK'
  | 'TASK_SUBMISSION'
  | 'EVALUATION_GRADE'
  | 'CERTIFICATE_GENERATION'
  | 'STUDENT_AUTH'
  | 'ADMIN_AUTH'
  | 'S3_PRESIGNED_UPLOAD'
  | 'S3_FILE_DOWNLOAD';

export type WorkflowStatus = 'SUCCESS' | 'FAILURE' | 'BLOCKED';

export interface WorkflowEvent {
  workflow: WorkflowType;
  status: WorkflowStatus;
  durationMs?: number;
  actorId?: string;
  actorRole?: 'STUDENT' | 'ADMIN' | 'TRAINER' | 'SYSTEM';
  targetId?: string;
  requestId?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

const REDACTED_KEYS_REGEX = /password|pin|pinhash|secret|token|authorization|cookie|apikey|jwt/i;

/**
 * Deeply sanitizes objects, redacting any sensitive credentials or secrets.
 */
export function sanitizeLogData(data: any): any {
  if (data === null || data === undefined) return data;

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEYS_REGEX.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Emits AWS CloudWatch Embedded Metric Format (EMF) logs.
 * CloudWatch automatically extracts custom metrics and dimensions directly from
 * structured JSON logs without requiring CloudWatch agent configuration or extra API costs.
 */
function emitCloudWatchEmf(metricName: string, value: number, unit: 'Count' | 'Milliseconds' | 'Bytes', dimensions: Record<string, string>) {
  const timestamp = Date.now();
  const dimensionKeys = Object.keys(dimensions);

  const emfPayload = {
    _aws: {
      Timestamp: timestamp,
      CloudWatchMetrics: [
        {
          Namespace: 'ARVR/Academy',
          Dimensions: [dimensionKeys],
          Metrics: [
            {
              Name: metricName,
              Unit: unit,
            },
          ],
        },
      ],
    },
    ...dimensions,
    [metricName]: value,
  };

  // Standard output in production is collected by CloudWatch logs
  console.log(`[CLOUDWATCH_EMF] ${JSON.stringify(emfPayload)}`);
}

/**
 * Structured Application Logger
 */
export const logger = {
  info: (message: string, context?: Record<string, any>) => {
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      context: sanitizeLogData(context || {}),
    };
    console.log(`[APP_INFO] ${JSON.stringify(payload)}`);
  },

  warn: (message: string, context?: Record<string, any>) => {
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      context: sanitizeLogData(context || {}),
    };
    console.warn(`[APP_WARN] ${JSON.stringify(payload)}`);
  },

  error: (message: string, error?: any, context?: Record<string, any>) => {
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: error
        ? {
            name: error.name || 'Error',
            message: error.message || String(error),
            code: error.code,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
          }
        : undefined,
      context: sanitizeLogData(context || {}),
    };
    console.error(`[APP_ERROR] ${JSON.stringify(payload)}`);
  },
};

/**
 * Emits a structured business workflow event and records corresponding CloudWatch metrics.
 */
export function recordWorkflowEvent(event: WorkflowEvent): void {
  const isSuccess = event.status === 'SUCCESS';
  const durationMs = event.durationMs ?? 0;

  // 1. Structured JSON Event Log
  const eventPayload = {
    timestamp: new Date().toISOString(),
    channel: 'BUSINESS_WORKFLOW',
    workflow: event.workflow,
    status: event.status,
    durationMs,
    actorId: event.actorId || 'anonymous',
    actorRole: event.actorRole || 'unknown',
    targetId: event.targetId,
    requestId: event.requestId,
    errorCode: event.errorCode,
    errorMessage: event.errorMessage,
    metadata: sanitizeLogData(event.metadata || {}),
  };

  if (isSuccess) {
    console.log(`[WORKFLOW_EVENT] ${JSON.stringify(eventPayload)}`);
  } else {
    console.error(`[WORKFLOW_FAILURE] ${JSON.stringify(eventPayload)}`);
  }

  // 2. CloudWatch EMF Metrics Emission
  try {
    const env = process.env.NODE_ENV || 'production';
    const dimensions = {
      Environment: env,
      Workflow: event.workflow,
      Status: event.status,
    };

    // Metric 1: Invocations count
    emitCloudWatchEmf('WorkflowInvocations', 1, 'Count', dimensions);

    // Metric 2: Success / Failure counter
    if (isSuccess) {
      emitCloudWatchEmf('WorkflowSuccess', 1, 'Count', dimensions);
    } else {
      emitCloudWatchEmf('WorkflowFailure', 1, 'Count', dimensions);
    }

    // Metric 3: Workflow Latency
    if (durationMs > 0) {
      emitCloudWatchEmf('WorkflowLatency', durationMs, 'Milliseconds', dimensions);
    }
  } catch {
    // Metric emission failure should never interrupt application logic
  }
}
