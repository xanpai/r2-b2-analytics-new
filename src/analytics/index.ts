/**
 * B2 Analytics Module
 * Tracks requests, errors, latency, and rate limits per B2 bucket
 *
 * B2 Rate Limiting Behavior:
 * - S3-Compatible API returns 503 for rate limiting (SlowDown)
 * - Native B2 API returns 429 for rate limiting
 * - Both should be tracked as rate limit events
 */

export interface B2RequestMetrics {
    bucket: string           // B2 bucket/host identifier
    statusCode: number       // HTTP status code
    latencyMs: number        // Request latency in milliseconds
    bytesTransferred: number // Bytes transferred
    isRateLimit: boolean     // Whether this was a rate limit (429 or 503)
    isError: boolean         // Whether this was an error (4xx/5xx)
    country?: string         // Request country (from CF headers)
    colo?: string            // Cloudflare colo
    retryCount: number       // Number of retries needed
}

/**
 * Extract bucket identifier from B2 URL
 * Handles various B2 URL formats
 */
export function extractBucketFromUrl(url: URL): string {
    const hostname = url.hostname

    // Format: bucketname.s3.region.backblazeb2.com
    if (hostname.includes('backblazeb2.com')) {
        const parts = hostname.split('.')
        return parts[0] || 'unknown'
    }

    // Format: s3.region.backblazeb2.com/bucketname/...
    if (hostname.includes('backblazeb2') || hostname.includes('b2.')) {
        const pathParts = url.pathname.split('/')
        if (pathParts.length > 1 && pathParts[1]) {
            return pathParts[1]
        }
    }

    // Cloudflare R2 format: accountid.r2.cloudflarestorage.com
    if (hostname.includes('r2.cloudflarestorage.com')) {
        const parts = hostname.split('.')
        return parts[0] || 'r2-unknown'
    }

    // Custom domain - use full hostname
    return hostname
}

/**
 * Write analytics data point to Cloudflare Analytics Engine
 * Note: Analytics Engine only supports 1 index, so we use bucket as the primary index
 * and store other dimensions in blobs for filtering
 */
export function writeAnalytics(
    analyticsEngine: AnalyticsEngineDataset | undefined,
    metrics: B2RequestMetrics
): void {
    if (!analyticsEngine) {
        return
    }

    try {
        const now = new Date()
        const dateStr = now.toISOString().split('T')[0]
        const hourStr = now.getUTCHours().toString().padStart(2, '0')

        // Status categories:
        // - "rate_limit" for 429 and 503 (B2 rate limiting)
        // - "2xx", "3xx", "4xx", "5xx" for other status codes
        const statusCategory = metrics.isRateLimit ? 'rate_limit' :
            metrics.statusCode < 300 ? '2xx' :
            metrics.statusCode < 400 ? '3xx' :
            metrics.statusCode < 500 ? '4xx' : '5xx'

        analyticsEngine.writeDataPoint({
            // Only 1 index supported - use bucket name for grouping
            indexes: [metrics.bucket],
            // Store other dimensions in blobs for filtering
            blobs: [
                statusCategory,                          // blob1: status category (2xx, 4xx, rate_limit, 5xx)
                metrics.statusCode.toString(),           // blob2: exact status code
                metrics.country || 'unknown',            // blob3: country
                metrics.colo || 'unknown',               // blob4: colo
                dateStr,                                 // blob5: date (YYYY-MM-DD)
                hourStr,                                 // blob6: hour (00-23)
            ],
            doubles: [
                1,                                       // double1: request count (always 1)
                metrics.latencyMs,                       // double2: latency in ms
                metrics.bytesTransferred,                // double3: bytes transferred
                metrics.isRateLimit ? 1 : 0,             // double4: rate limit count (429 or 503)
                metrics.isError ? 1 : 0,                 // double5: error count
                metrics.retryCount,                      // double6: retry count
                metrics.statusCode >= 200 && metrics.statusCode < 300 ? 1 : 0, // double7: success count
            ]
        })
    } catch (error) {
        // Silently fail - don't let analytics break the main request
        console.error('Analytics write error:', error)
    }
}

/**
 * Create metrics object from request/response data
 *
 * @param url - The B2 URL being requested
 * @param statusCode - HTTP status code from B2
 * @param startTime - Request start timestamp
 * @param bytesTransferred - Number of bytes transferred
 * @param retryCount - Number of retry attempts
 * @param cf - Cloudflare request properties
 * @param forceRateLimit - Force rate limit flag (for 503 which is B2's rate limit response)
 */
export function createMetrics(
    url: URL,
    statusCode: number,
    startTime: number,
    bytesTransferred: number,
    retryCount: number,
    cf?: IncomingRequestCfProperties,
    forceRateLimit?: boolean
): B2RequestMetrics {
    // B2 S3 API returns 503 for rate limiting, Native API returns 429
    const isRateLimit = forceRateLimit || statusCode === 429 || statusCode === 503

    return {
        bucket: extractBucketFromUrl(url),
        statusCode,
        latencyMs: Date.now() - startTime,
        bytesTransferred,
        isRateLimit,
        isError: statusCode >= 400,
        country: cf?.country as string | undefined,
        colo: cf?.colo as string | undefined,
        retryCount,
    }
}
