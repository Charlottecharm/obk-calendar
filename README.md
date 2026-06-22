# OBK Calendar

A web-based calendar for OBK (Sydney, AU) that displays Salesforce events, volunteer timeslots, and Jewish holidays in a color-coded FullCalendar interface. Built with Express.js, deployed on Vercel, backed by AWS (Lambda + DynamoDB + API Gateway).

---

## Architecture Overview

```
Browser (FullCalendar v6)
    │
    └── Express server (Vercel)
            │
            └── AWS API Gateway (ap-southeast-2)
                    │
                    ├── GET  /events  ─── Lambda (prod-calendar-sync)
                    └── POST /sync   ─── Lambda (prod-calendar-sync)
                                            │
                                            ├── Salesforce (jsforce) ── on sync
                                            └── DynamoDB (prod-calendar-events) ── on read
```

**Data sources stored in DynamoDB:**
| Source | `source` field | `pk` prefix |
|--------|---------------|-------------|
| Salesforce Opportunities | `SALESFORCE` | `EVENT#` |
| Volunteer Timeslots | `SALESFORCE` | `TIMESLOT#` |
| Jewish Holidays | `JEWISH_HOLIDAYS` | `EVENT#JH-` |

---

## Project Structure

```
obk-calendar/
├── server.js               # Express server — proxies to AWS API Gateway
├── vercel.json             # Vercel deployment config
├── package.json
├── .env.example            # Required environment variables
├── public/
│   ├── index.html          # Single-page app shell (FullCalendar + MDL)
│   ├── script.js           # Calendar init, event mapping, Jewish holiday blocking
│   └── style.css           # Event type color themes + Jewish holiday overlays
├── Documentation/
│   ├── UPDATE_JEWISH_HOLIDAYS.md       # Step-by-step guide for annual holiday updates
│   ├── sample_calendar_item_in_dynamodb.md  # DynamoDB item schema example
│   ├── nsw-holidays-dynamodb.json      # NSW public holidays (DynamoDB format)
│   ├── nsw-holidays-batch-write.json   # NSW public holidays (batch-write format)
│   ├── jewish-holidays-dynamodb.json   # Jewish holidays (DynamoDB format)
│   ├── jewish-holidays-batch-write.json # Jewish holidays (batch-write format)
│   └── cfm/
│       ├── calendar-sync-core          # CloudFormation: DynamoDB table
│       ├── calendar-sync-iam           # CloudFormation: Lambda IAM role
│       └── calendar-sync-lambda        # CloudFormation: Lambda + API Gateway + EventBridge
├── Update_lambda.md        # Quick reference for Lambda updates and troubleshooting
└── old_code.md             # Legacy Salesforce-direct server code (reference only)
```

---

## Environment Variables

Copy `.env.example` and fill in values:

```env
SF_LOGIN_URL=https://obk--sfcalendar.sandbox.my.salesforce.com
SF_USERNAME=your_username
SF_PASSWORD=your_password
SF_SECURITY_TOKEN=your_security_token
```

> **Note:** Salesforce credentials are only used by the AWS Lambda function via Secrets Manager — not by the Express server directly. The Express server only needs `API_GATEWAY_URL` (defaults to the prod endpoint if unset).

---

## Local Development

```bash
npm install
npm run dev        # Starts Vercel dev server (mirrors production routing)
# or
npm start          # Starts plain Express server on port 3000
```

The app will be available at `http://localhost:3000`.

---

## API Endpoints

### `GET /api/opportunities`
Returns calendar events for the requested date range.

**Query params:** `start`, `end` (ISO 8601). Defaults to `-30 days` → `+90 days` from today.

**Response:**
```json
{
  "opportunities": [
    {
      "Id": "...",
      "Name": "...",
      "Event_Start_Date_Time__c": "2025-09-14T15:00:00+10:00",
      "Event_End_Date_Time__c": "2025-09-14T16:30:00+10:00",
      "Type": "Corporate Event"
    }
  ],
  "timeslots": [
    {
      "Id": "...",
      "Name": "...",
      "goldenapp__Start__c": "...",
      "goldenapp__End__c": "..."
    }
  ]
}
```

### `POST /api/sync`
Triggers a Salesforce → DynamoDB sync via the Lambda function. Returns `{ message: "Sync completed successfully" }` on success.

---

## Event Types & Color Coding

| Type | Background | Left border | Dot |
|------|-----------|-------------|-----|
| Corporate Event | `#DCFFF1` (mint) | `#4BCE97` green | green |
| School Program | `#DCFFF1` (mint) | `#4BCE97` green | green |
| OOSH - Vacation Care | `#DCFFF1` (mint) | `#4BCE97` green | green |
| Cooking with Family | `#FFECF8` (pink) | `#E774BB` pink | yellow |
| Birthday Party | `#FFECF8` (pink) | `#E774BB` pink | yellow |
| OBK Catering | `#DFD8FD` (lavender) | `#9F8FEF` purple | purple |
| Volunteer timeslot | `#FFF7D6` (yellow) | `#F5CD47` yellow | yellow |
| Jewish Holiday | `#FF5252` (red) | `#D32F2F` dark red | red |

Jewish holiday days also display a diagonal **"KITCHEN CLOSED"** watermark across the entire day column in the time grid view, and **"CLOSED"** in the week view.

---

## AWS Infrastructure

Three CloudFormation stacks (in `Documentation/cfm/`) define the backend:

### 1. `calendar-sync-core`
Creates the DynamoDB table `prod-calendar-events` with:
- **PK:** `pk` (String) — e.g. `EVENT#<salesforce-id>` or `EVENT#JH-ROSH-HASHANAH-2025`
- **SK:** `sk` (String) — e.g. `METADATA#2025-09-22`
- Provisioned throughput: 5 RCU / 5 WCU
- SSE enabled

### 2. `calendar-sync-iam`
IAM role for the Lambda function with permissions:
- `dynamodb:PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `GetItem` on the events table
- `secretsmanager:GetSecretValue` for the Salesforce credentials secret

### 3. `calendar-sync-lambda`
- **Lambda** (`prod-calendar-sync`): Node.js 18, 1 GB RAM, 5 min timeout, 1 reserved concurrency
  - `GET /events` — reads from DynamoDB filtered by date range
  - `POST /sync` — queries Salesforce via jsforce, writes all results to DynamoDB in 25-item batches
- **API Gateway** (`prod-calendar-api`) with `GET /events` and `POST /sync` routes
- **EventBridge rule** — triggers daily auto-sync from Salesforce

---

## Updating the Lambda Function

```bash
cd lambda-current
zip -r lambda-deployment.zip . -x "*.DS_Store" "current-lambda.zip"
aws lambda update-function-code --function-name prod-calendar-sync --zip-file fileb://lambda-deployment.zip
```

To change the sync date window, edit `index.js` inside the Lambda and redeploy. A commented `if (true)` toggle in the source code forces an immediate resync without waiting for a scheduled event.

**View recent logs:**
```bash
aws logs filter-log-events \
  --log-group-name "/aws/lambda/prod-calendar-sync" \
  --start-time $(date -u -v-30M +%s)000 \
  --query 'events[*].[timestamp,message]'
```

---

## Updating Jewish Holidays

Jewish holidays are stored directly in DynamoDB and are **not** synced from Salesforce. They must be updated manually each year (recommended: every August for the next 2–3 years).

See [`Documentation/UPDATE_JEWISH_HOLIDAYS.md`](Documentation/UPDATE_JEWISH_HOLIDAYS.md) for the full step-by-step process including:
- Holiday dates research
- DynamoDB item format (`source: "JEWISH_HOLIDAYS"`, `pk: "EVENT#JH-<HOLIDAY>-<YEAR>"`)
- Batch upload via AWS CLI
- Verification steps

**Quick upload:**
```bash
aws dynamodb batch-write-item --request-files file://Documentation/jewish-holidays-batch-write.json
```

---

## Deployment

The app is deployed on **Vercel**. The `vercel.json` routes:
- `/api/*` → `server.js` (Node.js serverless)
- `/` → `public/index.html`
- `/*` → `public/` static files

```bash
vercel deploy        # Preview deployment
vercel deploy --prod # Production deployment
```

---

## Timezone

All events are displayed in **`Australia/Sydney`** (UTC+10/+11 with DST). The calendar and Lambda both use `moment-timezone` for conversions. DynamoDB stores all timestamps in UTC.
