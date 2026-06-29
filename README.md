# OBK Calendar

Live calendar for Our Big Kitchen (OBK) Sydney, displaying Salesforce event bookings and volunteer timeslots.

**Live URL:** https://obk-calendar-xi.vercel.app/

---

## Architecture

```
Browser (FullCalendar)
    │
    Vercel (Express server)
        │
        AWS API Gateway  (us-east-1)
            │
            ├── GET  /events ──► Lambda reads DynamoDB
            └── POST /sync  ──► Lambda queries Salesforce → writes DynamoDB
```

| Layer | Service | Name |
|-------|---------|------|
| Frontend | Vercel | obk-calendar-xi.vercel.app |
| API | AWS API Gateway | prod-calendar-api (us-east-1) |
| Function | AWS Lambda | prod-calendar-sync (us-east-1) |
| Database | AWS DynamoDB | prod-calendar-events (us-east-1) |
| Source of truth | Salesforce | obk.lightning.force.com |

---

## How it works

1. A Salesforce sync runs every 4 hours via EventBridge (`prod-daily-calendar-sync`)
2. The Lambda queries two Salesforce objects:
   - **Opportunity** (Record Type: Event Booking) — main calendar events
   - **goldenapp__Volunteer_Opportunity_Timeslot__c** — volunteer timeslots
3. Data is written to DynamoDB with `pk = EVENT#<id>` or `TIMESLOT#<id>`
4. Jewish holidays and NSW public holidays are stored separately in DynamoDB (static data, 2025–2027)
5. The Vercel frontend fetches from `/api/opportunities` which proxies to API Gateway → Lambda → DynamoDB
6. Users can force an immediate sync at any time using the **Refresh** button in the calendar toolbar

---

## Event types and colours

| Type | Colour |
|------|--------|
| Corporate Event | Green |
| School Program | Green |
| OOSH / Vacation Care | Green |
| Cooking with Family | Pink |
| Birthday Party | Pink |
| OBK Catering | Purple |
| Volunteer timeslot | Yellow |
| Jewish Holiday | Red (KITCHEN CLOSED) |

---

## AWS Resources

| Resource | Name | Region |
|----------|------|--------|
| Lambda | prod-calendar-sync | us-east-1 |
| DynamoDB | prod-calendar-events | us-east-1 |
| API Gateway | prod-calendar-api | us-east-1 |
| Secrets Manager | prod/salesforce/calendar | us-east-1 |
| EventBridge rule | prod-daily-calendar-sync | us-east-1 |

---

## Environment variables

### Lambda (AWS)
| Variable | Value |
|----------|-------|
| `TABLE_NAME` | `prod-calendar-events` |
| `SECRET_NAME` | `prod/salesforce/calendar` |
| `SF_RECORD_TYPE_ID` | `0129q0000004JvEAAU` |

### Vercel
| Variable | Value |
|----------|-------|
| `API_GATEWAY_URL` | `https://j3fgh9q1o4.execute-api.us-east-1.amazonaws.com/prod` |

---

## UI

- **Font:** Arial, Helvetica, sans-serif (matches OBK website)
- **Views:** Week and Day (default: Day)
- **Day title format:** `Mon - 29/6`
- **Refresh button:** Forces an immediate Salesforce sync without waiting for the 4-hour schedule. Shows "Syncing..." while in progress (~5 seconds), then reloads the calendar with fresh data.

---

## Ongoing maintenance

| Task | How |
|------|-----|
| Force a re-sync now | Click the **Refresh** button on the calendar, or Lambda → Test tab → run the `ManualSync` test event (`{ "httpMethod": "POST" }`) |
| View sync logs | CloudWatch → Log groups → `/aws/lambda/prod-calendar-sync` |
| Update Jewish holidays | See `Documentation/UPDATE_JEWISH_HOLIDAYS.md` |
| Update Lambda code | Re-zip `lambda/` contents → Lambda → Upload from .zip |
| Redeploy frontend | Push to GitHub → Vercel auto-deploys |

---

## Fresh deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full step-by-step instructions to replicate this on a new AWS + Vercel account.
