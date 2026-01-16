/**
 * B2 Analytics Module
 * Tracks requests, errors, latency, and rate limits per B2 bucket
 */

export interface AnalyticsDataPoint {
    // Indexes (filterable dimensions) - up to 20
    indexes: string[]
    // Blobs (string data) - up to 20
    blobs?: string[]
    // Doubles (numeric data) - up to 20
    doubles?: number[]
}

export interface B2RequestMetrics {
    bucket: string           // B2 bucket/host identifier
    statusCode: number       // HTTP status code
    latencyMs: number        // Request latency in milliseconds
    bytesTransferred: number // Bytes transferred
    isRateLimit: boolean     // Whether this was a 429 rate limit
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
 */
export function writeAnalytics(
    analyticsEngine: AnalyticsEngineDataset | undefined,
    metrics: B2RequestMetrics
): void {
    if (!analyticsEngine) {
        return
    }

    try {
        // Structure:
        // index1: bucket name (for filtering by bucket)
        // index2: status code category (2xx, 4xx, 5xx, 429)
        // index3: country
        // index4: colo
        // index5: date (YYYY-MM-DD for daily aggregation)
        // index6: hour (HH for hourly patterns)

        const now = new Date()
        const dateStr = now.toISOString().split('T')[0]
        const hourStr = now.getUTCHours().toString().padStart(2, '0')

        const statusCategory = metrics.isRateLimit ? '429' :
            metrics.statusCode < 300 ? '2xx' :
            metrics.statusCode < 400 ? '3xx' :
            metrics.statusCode < 500 ? '4xx' : '5xx'

        analyticsEngine.writeDataPoint({
            indexes: [
                metrics.bucket,                          // index1: bucket
                statusCategory,                          // index2: status category
                metrics.country || 'unknown',            // index3: country
                metrics.colo || 'unknown',               // index4: colo
                dateStr,                                 // index5: date
                hourStr,                                 // index6: hour
            ],
            blobs: [
                metrics.statusCode.toString(),           // blob1: exact status code
                metrics.isRateLimit ? 'true' : 'false',  // blob2: is rate limit
                metrics.isError ? 'true' : 'false',      // blob3: is error
            ],
            doubles: [
                1,                                       // double1: request count (always 1)
                metrics.latencyMs,                       // double2: latency in ms
                metrics.bytesTransferred,                // double3: bytes transferred
                metrics.isRateLimit ? 1 : 0,             // double4: rate limit count
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
 */
export function createMetrics(
    url: URL,
    statusCode: number,
    startTime: number,
    bytesTransferred: number,
    retryCount: number,
    cf?: IncomingRequestCfProperties
): B2RequestMetrics {
    return {
        bucket: extractBucketFromUrl(url),
        statusCode,
        latencyMs: Date.now() - startTime,
        bytesTransferred,
        isRateLimit: statusCode === 429,
        isError: statusCode >= 400,
        country: cf?.country as string | undefined,
        colo: cf?.colo as string | undefined,
        retryCount,
    }
}
