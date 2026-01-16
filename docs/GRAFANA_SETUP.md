# Grafana Setup Guide for B2 Analytics

This guide explains how to visualize your B2 request analytics in Grafana using Cloudflare Analytics Engine.

## Prerequisites

- Grafana instance (self-hosted or Grafana Cloud)
- Cloudflare account with Analytics Engine enabled
- API Token with Analytics read permissions

## Step 1: Create Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use **Custom Token** template
4. Configure permissions:
   - **Account** → **Account Analytics** → **Read**
   - **Account** → **Analytics Engine** → **Read** (if available)
5. Set **Account Resources** to your specific account
6. Click **Continue to summary** → **Create Token**
7. **Save the token** - you won't see it again!

## Step 2: Install Cloudflare Plugin in Grafana

### For Grafana Cloud:
1. Go to **Configuration** → **Plugins**
2. Search for "Cloudflare"
3. Install the **Cloudflare** plugin

### For Self-hosted Grafana:
```bash
grafana-cli plugins install cloudflare-app
systemctl restart grafana-server
```

## Step 3: Configure Data Source

1. Go to **Configuration** → **Data Sources** → **Add data source**
2. Search for "Cloudflare"
3. Configure:
   - **API Token**: Your token from Step 1
   - **Account ID**: `ada53f8b991fa630453761c771c015cf`
4. Click **Save & Test**

## Step 4: Create Dashboard

### Option A: Import Pre-built Dashboard

Create a new dashboard and add panels with these queries:

### Option B: Manual Panel Setup

#### Panel 1: Rate Limits by Bucket (Time Series)

```sql
SELECT
  toStartOfInterval(timestamp, INTERVAL '5' MINUTE) as time,
  index1 as bucket,
  SUM(double4) as rate_limits
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY time, bucket
ORDER BY time
```

#### Panel 2: Requests by Bucket (Pie Chart)

```sql
SELECT
  index1 as bucket,
  SUM(_sample_interval) as requests
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY bucket
ORDER BY requests DESC
```

#### Panel 3: Average Latency by Bucket (Bar Gauge)

```sql
SELECT
  index1 as bucket,
  AVG(double2) as avg_latency_ms
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY bucket
ORDER BY avg_latency_ms DESC
```

#### Panel 4: Error Rate by Bucket (Stat)

```sql
SELECT
  index1 as bucket,
  SUM(double5) as errors,
  SUM(_sample_interval) as total,
  (SUM(double5) / SUM(_sample_interval) * 100) as error_rate_pct
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY bucket
ORDER BY error_rate_pct DESC
```

#### Panel 5: Hourly Request Pattern (Heatmap)

```sql
SELECT
  blob6 as hour,
  index1 as bucket,
  SUM(_sample_interval) as requests
FROM b2_request_metrics
WHERE blob5 = FORMAT_DATETIME(NOW(), 'yyyy-MM-dd')
GROUP BY hour, bucket
ORDER BY hour
```

#### Panel 6: Geographic Distribution (World Map)

```sql
SELECT
  blob3 as country,
  SUM(_sample_interval) as requests,
  SUM(double4) as rate_limits
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY country
ORDER BY requests DESC
```

#### Panel 7: Retry Analysis (Time Series)

```sql
SELECT
  toStartOfInterval(timestamp, INTERVAL '5' MINUTE) as time,
  index1 as bucket,
  AVG(double6) as avg_retries,
  MAX(double6) as max_retries
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '6' HOUR
GROUP BY time, bucket
ORDER BY time
```

## Data Schema Reference

### Index (Groupable)
| Field | Description |
|-------|-------------|
| `index1` | B2 Bucket name |

### Blobs (Filterable Strings)
| Field | Description |
|-------|-------------|
| `blob1` | Status category: `2xx`, `3xx`, `4xx`, `rate_limit`, `5xx` |
| `blob2` | Exact HTTP status code |
| `blob3` | Country code (e.g., `US`, `DE`) |
| `blob4` | Cloudflare colo (e.g., `DFW`, `AMS`) |
| `blob5` | Date (`YYYY-MM-DD`) |
| `blob6` | Hour (`00`-`23`) |

### Doubles (Numeric Metrics)
| Field | Description |
|-------|-------------|
| `double1` | Request count (always 1) |
| `double2` | Latency in milliseconds |
| `double3` | Bytes transferred |
| `double4` | Rate limit flag (1 = rate limited, 0 = not) |
| `double5` | Error flag (1 = error, 0 = success) |
| `double6` | Retry count |
| `double7` | Success flag (1 = success, 0 = not) |

## Useful Queries

### Find Problematic Buckets (Rate Limited)

```sql
SELECT
  index1 as bucket,
  SUM(double4) as rate_limit_count,
  SUM(_sample_interval) as total_requests,
  ROUND(SUM(double4) / SUM(_sample_interval) * 100, 2) as rate_limit_pct
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY bucket
HAVING rate_limit_count > 0
ORDER BY rate_limit_count DESC
```

### High Latency Buckets

```sql
SELECT
  index1 as bucket,
  ROUND(AVG(double2), 2) as avg_latency_ms,
  ROUND(MAX(double2), 2) as max_latency_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY double2), 2) as p95_latency_ms
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY bucket
ORDER BY avg_latency_ms DESC
```

### Requests with Retries

```sql
SELECT
  index1 as bucket,
  SUM(CASE WHEN double6 > 0 THEN 1 ELSE 0 END) as requests_with_retries,
  SUM(_sample_interval) as total_requests,
  ROUND(AVG(double6), 2) as avg_retries
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY bucket
ORDER BY requests_with_retries DESC
```

### Status Code Breakdown

```sql
SELECT
  index1 as bucket,
  blob1 as status_category,
  SUM(_sample_interval) as count
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY bucket, status_category
ORDER BY bucket, count DESC
```

## Setting Up Alerts

### Alert: High Rate Limit Rate

Create an alert rule:
- **Condition**: `rate_limit_pct > 5`
- **Query**:
```sql
SELECT
  index1 as bucket,
  (SUM(double4) / SUM(_sample_interval) * 100) as rate_limit_pct
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '15' MINUTE
GROUP BY bucket
HAVING rate_limit_pct > 5
```

### Alert: High Latency

Create an alert rule:
- **Condition**: `avg_latency_ms > 5000`
- **Query**:
```sql
SELECT
  index1 as bucket,
  AVG(double2) as avg_latency_ms
FROM b2_request_metrics
WHERE timestamp > NOW() - INTERVAL '5' MINUTE
GROUP BY bucket
HAVING avg_latency_ms > 5000
```

## B2 Rate Limiting Reference

### Error Codes
- **503**: S3-Compatible API rate limit (SlowDown)
- **429**: Native B2 API rate limit

### Best Practices
1. Monitor `rate_limit` status category for early warning
2. Set up alerts when rate limit percentage exceeds 5%
3. Use the retry count metric to identify buckets that need optimization
4. Consider moving hot files to separate buckets to distribute load

### Sources
- [Backblaze Rate Limiting Policy](https://www.backblaze.com/blog/rate-limiting-policy/)
- [B2 S3 Compatible API](https://www.backblaze.com/apidocs/introduction-to-the-s3-compatible-api)
- [B2 Integration Checklist](https://www.backblaze.com/docs/cloud-storage-integration-checklist)

## Troubleshooting

### No data appearing
1. Ensure the worker is receiving traffic
2. Check Analytics Engine in Cloudflare dashboard
3. Verify the dataset name matches: `b2_request_metrics`

### API Token errors
1. Ensure token has Analytics read permissions
2. Check Account ID is correct
3. Try regenerating the token

### Query errors
1. Check column names match the schema above
2. Ensure timestamp filters are using correct syntax
3. Try simpler queries first to verify connectivity
