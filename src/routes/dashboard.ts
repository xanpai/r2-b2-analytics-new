import { IRequest, json } from 'itty-router'

/**
 * Dashboard HTML page for viewing B2 analytics
 * Note: To query Analytics Engine data, you need to use the GraphQL API
 * from your Cloudflare dashboard or a separate admin service.
 *
 * This endpoint provides:
 * 1. A simple HTML dashboard that can be extended
 * 2. JSON endpoint for programmatic access
 */

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>B2 Analytics Dashboard</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            color: #e4e4e4;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 {
            font-size: 2rem;
            margin-bottom: 30px;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        h1::before {
            content: '📊';
            font-size: 2.5rem;
        }
        .info-box {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .info-box h2 {
            color: #ffd700;
            margin-bottom: 15px;
            font-size: 1.2rem;
        }
        .info-box p { line-height: 1.6; margin-bottom: 10px; }
        .info-box code {
            background: rgba(0, 0, 0, 0.3);
            padding: 2px 8px;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', monospace;
            color: #00ff88;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 25px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .card h3 {
            font-size: 0.9rem;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        .card .value {
            font-size: 2.5rem;
            font-weight: bold;
            color: #fff;
        }
        .card .sub {
            font-size: 0.85rem;
            color: #666;
            margin-top: 5px;
        }
        .card.rate-limit .value { color: #ff6b6b; }
        .card.success .value { color: #00ff88; }
        .card.latency .value { color: #ffd700; }
        .metrics-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .metrics-table th, .metrics-table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .metrics-table th {
            background: rgba(0, 0, 0, 0.2);
            color: #888;
            text-transform: uppercase;
            font-size: 0.8rem;
            letter-spacing: 1px;
        }
        .metrics-table tr:hover { background: rgba(255, 255, 255, 0.02); }
        .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        .status-2xx { background: rgba(0, 255, 136, 0.2); color: #00ff88; }
        .status-4xx { background: rgba(255, 193, 7, 0.2); color: #ffc107; }
        .status-429 { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; }
        .status-5xx { background: rgba(255, 0, 0, 0.2); color: #ff4444; }
        .query-section {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
        }
        .query-section h4 {
            color: #ffd700;
            margin-bottom: 10px;
        }
        .query-section pre {
            background: rgba(0, 0, 0, 0.5);
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 0.85rem;
            line-height: 1.5;
        }
        .refresh-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            transition: transform 0.2s;
        }
        .refresh-btn:hover { transform: scale(1.05); }
        .timestamp {
            color: #666;
            font-size: 0.85rem;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>B2 Analytics Dashboard</h1>

        <div class="info-box">
            <h2>📌 How to View Analytics Data</h2>
            <p>
                Analytics data is stored in Cloudflare Analytics Engine. To query it:
            </p>
            <p>
                1. Go to your <strong>Cloudflare Dashboard</strong> → <strong>Workers & Pages</strong> → <strong>Analytics Engine</strong>
            </p>
            <p>
                2. Select the dataset: <code>b2_request_metrics</code>
            </p>
            <p>
                3. Use the GraphQL API or SQL API to query your data
            </p>
        </div>

        <div class="grid">
            <div class="card success">
                <h3>Tracked Metrics</h3>
                <div class="value">7</div>
                <div class="sub">Data points per request</div>
            </div>
            <div class="card rate-limit">
                <h3>Rate Limit Tracking</h3>
                <div class="value">429</div>
                <div class="sub">Automatic detection</div>
            </div>
            <div class="card latency">
                <h3>Latency Tracking</h3>
                <div class="value">ms</div>
                <div class="sub">Per-request precision</div>
            </div>
            <div class="card">
                <h3>Bucket Breakdown</h3>
                <div class="value">✓</div>
                <div class="sub">Per-bucket analytics</div>
            </div>
        </div>

        <div class="info-box">
            <h2>📊 Available Data Points</h2>
            <table class="metrics-table">
                <thead>
                    <tr>
                        <th>Index/Field</th>
                        <th>Type</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>index1</code></td>
                        <td>String</td>
                        <td>B2 Bucket name</td>
                    </tr>
                    <tr>
                        <td><code>index2</code></td>
                        <td>String</td>
                        <td>Status category (2xx, 4xx, 429, 5xx)</td>
                    </tr>
                    <tr>
                        <td><code>index3</code></td>
                        <td>String</td>
                        <td>Country code</td>
                    </tr>
                    <tr>
                        <td><code>index4</code></td>
                        <td>String</td>
                        <td>Cloudflare colo</td>
                    </tr>
                    <tr>
                        <td><code>index5</code></td>
                        <td>String</td>
                        <td>Date (YYYY-MM-DD)</td>
                    </tr>
                    <tr>
                        <td><code>index6</code></td>
                        <td>String</td>
                        <td>Hour (00-23)</td>
                    </tr>
                    <tr>
                        <td><code>double1</code></td>
                        <td>Number</td>
                        <td>Request count (always 1)</td>
                    </tr>
                    <tr>
                        <td><code>double2</code></td>
                        <td>Number</td>
                        <td>Latency (ms)</td>
                    </tr>
                    <tr>
                        <td><code>double3</code></td>
                        <td>Number</td>
                        <td>Bytes transferred</td>
                    </tr>
                    <tr>
                        <td><code>double4</code></td>
                        <td>Number</td>
                        <td>Rate limit count (0 or 1)</td>
                    </tr>
                    <tr>
                        <td><code>double5</code></td>
                        <td>Number</td>
                        <td>Error count (0 or 1)</td>
                    </tr>
                    <tr>
                        <td><code>double6</code></td>
                        <td>Number</td>
                        <td>Retry count</td>
                    </tr>
                    <tr>
                        <td><code>double7</code></td>
                        <td>Number</td>
                        <td>Success count (0 or 1)</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="info-box">
            <h2>🔍 Example Queries</h2>

            <div class="query-section">
                <h4>Rate limits by bucket (last 24 hours)</h4>
                <pre>SELECT
  index1 as bucket,
  SUM(double4) as rate_limit_count,
  SUM(double1) as total_requests,
  (SUM(double4) / SUM(double1) * 100) as rate_limit_percentage
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY index1
ORDER BY rate_limit_count DESC</pre>
            </div>

            <div class="query-section">
                <h4>Average latency by bucket</h4>
                <pre>SELECT
  index1 as bucket,
  AVG(double2) as avg_latency_ms,
  MAX(double2) as max_latency_ms,
  SUM(double1) as total_requests
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY index1
ORDER BY avg_latency_ms DESC</pre>
            </div>

            <div class="query-section">
                <h4>Hourly request pattern</h4>
                <pre>SELECT
  index6 as hour,
  SUM(double1) as requests,
  SUM(double4) as rate_limits,
  AVG(double2) as avg_latency
FROM b2_request_metrics
WHERE index5 = CURRENT_DATE()
GROUP BY index6
ORDER BY index6</pre>
            </div>

            <div class="query-section">
                <h4>Error breakdown by bucket</h4>
                <pre>SELECT
  index1 as bucket,
  index2 as status_category,
  SUM(double1) as count
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '24' HOUR
  AND index2 != '2xx'
GROUP BY index1, index2
ORDER BY count DESC</pre>
            </div>
        </div>

        <p class="timestamp">Dashboard loaded at: <span id="time"></span></p>
    </div>
    <script>
        document.getElementById('time').textContent = new Date().toISOString();
    </script>
</body>
</html>`

export const dashboard = async (request: IRequest, env: Env) => {
    // Check for JSON request
    const accept = request.headers.get('accept') || ''
    if (accept.includes('application/json')) {
        return json({
            status: 'ok',
            dataset: 'b2_request_metrics',
            metrics: {
                indexes: [
                    'bucket (B2 bucket name)',
                    'status_category (2xx, 4xx, 429, 5xx)',
                    'country',
                    'colo',
                    'date (YYYY-MM-DD)',
                    'hour (00-23)'
                ],
                doubles: [
                    'request_count',
                    'latency_ms',
                    'bytes_transferred',
                    'rate_limit_count',
                    'error_count',
                    'retry_count',
                    'success_count'
                ]
            },
            query_endpoint: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql',
            documentation: 'https://developers.cloudflare.com/analytics/analytics-engine/'
        })
    }

    return new Response(DASHBOARD_HTML, {
        headers: {
            'content-type': 'text/html;charset=UTF-8',
            'cache-control': 'no-cache'
        }
    })
}

/**
 * Simple stats endpoint that returns basic info
 */
export const stats = async (request: IRequest, env: Env) => {
    return json({
        status: 'healthy',
        analytics_enabled: !!env.B2_ANALYTICS,
        dataset: 'b2_request_metrics',
        timestamp: new Date().toISOString()
    })
}
