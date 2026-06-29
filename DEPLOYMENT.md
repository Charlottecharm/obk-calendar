# OBK Calendar — Deployment Guide

This guide walks through setting up the OBK Calendar from scratch on your own Salesforce, AWS, and Vercel accounts. Complete the phases in order — each one builds on the last.

---

## Overview

```
Browser (FullCalendar)
    │
    └── Vercel (Express server)
            │
            └── AWS API Gateway
                    │
                    ├── GET  /events ──► Lambda reads DynamoDB
                    └── POST /sync  ──► Lambda queries Salesforce → writes DynamoDB
```

---

## Phase 1 — Salesforce

### Step 1 — Gather your credentials

You need four values from Salesforce:

| Value | Where to find it |
|-------|-----------------|
| **Login URL** | Your org's domain, e.g. `https://yourorg.my.salesforce.com` |
| **Username** | The API user's email address |
| **Password** | That user's password |
| **Security Token** | Profile → Settings → My Personal Information → Reset My Security Token (emailed to you) |

> **Sandbox?** Use `https://yourorg--sandbox.sandbox.my.salesforce.com` as the login URL.

Write these down — you'll need them in Step 4.

---

### Step 2 — Find your Opportunity RecordTypeId

1. In Salesforce, go to **Setup → Object Manager → Opportunity → Record Types**
2. Click the record type used for calendar events (e.g. "Events" or "Bookings")
3. Look at the URL — the ID is the long string that looks like `0129q0000004JvEAAU`
4. Copy it — you'll need it in Step 6

---

## Phase 2 — AWS

### Step 3 — Create the DynamoDB table

1. Open **AWS Console → DynamoDB → Create table**
2. Fill in:
   - **Table name:** `prod-calendar-events`
   - **Partition key:** `pk` (String)
   - **Sort key:** `sk` (String)
   - **Capacity mode:** On-demand (simplest, no provisioning needed)
3. Click **Create table**
4. Wait for status to show **Active**

---

### Step 4 — Store Salesforce credentials in Secrets Manager

1. Go to **AWS Console → Secrets Manager → Store a new secret**
2. Choose **Other type of secret**
3. Add key/value pairs (use your values from Step 1):
   ```
   loginUrl       →  https://yourorg.my.salesforce.com
   username       →  your-sf-username@example.com
   password       →  yourpassword
   securityToken  →  yourSecurityToken
   ```
4. Click **Next**
5. **Secret name:** `prod/salesforce/calendar`
6. Click through and **Store**

---

### Step 5 — Create the Lambda IAM Role

1. Go to **AWS Console → IAM → Roles → Create role**
2. **Trusted entity:** AWS service → Lambda
3. Click **Next**, then **Next** again (skip attaching managed policies for now)
4. **Role name:** `prod-calendar-lambda-role`
5. Click **Create role**
6. Open the role you just created → **Add permissions → Create inline policy**
7. Click the **JSON** tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:GetItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/prod-calendar-events"
    },
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:*:*:secret:prod/salesforce/calendar*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

8. **Policy name:** `prod-calendar-lambda-policy`
9. Click **Create policy**

---

### Step 6 — Package and deploy the Lambda function

**On your computer**, open a terminal and run:

```bash
cd "C:\Users\orvil\Downloads\obk-calendar-main\obk-calendar-main\lambda"
npm install
```

Then zip the entire `lambda` folder contents (not the folder itself — select `index.js`, `package.json`, and `node_modules`, then zip them).

**In AWS Console → Lambda → Create function:**

1. **Function name:** `prod-calendar-sync`
2. **Runtime:** Node.js 18.x
3. **Permissions:** Use an existing role → `prod-calendar-lambda-role`
4. Click **Create function**

**Upload your code:**

5. In the **Code** tab → **Upload from** → **.zip file** → upload your zip

**Set environment variables:**

6. Go to **Configuration → Environment variables → Edit → Add**:

   | Key | Value |
   |-----|-------|
   | `TABLE_NAME` | `prod-calendar-events` |
   | `SECRET_NAME` | `prod/salesforce/calendar` |
   | `SF_RECORD_TYPE_ID` | _(the ID from Step 2, e.g. `0129q0000004JvEAAU`)_ |

**Increase timeout and memory:**

7. Go to **Configuration → General configuration → Edit**:
   - **Timeout:** 5 min 0 sec
   - **Memory:** 1024 MB
8. Click **Save**

---

### Step 7 — Create the API Gateway

1. Go to **AWS Console → API Gateway → Create API**
2. Choose **REST API** (not HTTP API, not WebSocket)
3. **API name:** `prod-calendar-api`
4. Click **Create API**

**Create the `/events` resource:**

5. Click **Actions → Create Resource**
   - Resource name: `events`
   - Resource path: `/events`
   - Click **Create Resource**
6. With `/events` selected → **Actions → Create Method → GET**
   - Integration type: **Lambda Function**
   - Check **Use Lambda Proxy integration**
   - Lambda function: `prod-calendar-sync`
   - Click **Save → OK**

**Create the `/sync` resource:**

7. Click the root `/` in the resource tree → **Actions → Create Resource**
   - Resource name: `sync`
   - Resource path: `/sync`
   - Click **Create Resource**
8. With `/sync` selected → **Actions → Create Method → POST**
   - Integration type: **Lambda Function**
   - Check **Use Lambda Proxy integration**
   - Lambda function: `prod-calendar-sync`
   - Click **Save → OK**

**Deploy the API:**

9. **Actions → Deploy API**
   - Deployment stage: **[New Stage]**
   - Stage name: `prod`
   - Click **Deploy**
10. Copy the **Invoke URL** at the top — it looks like:
    ```
    https://xxxxxxxxxx.execute-api.ap-southeast-2.amazonaws.com/prod
    ```
    Save this — you'll need it in Step 10.

---

### Step 8 — Set up daily auto-sync (EventBridge)

1. Go to **AWS Console → EventBridge → Rules → Create rule**
2. **Name:** `prod-daily-calendar-sync`
3. **Rule type:** Schedule
4. **Schedule pattern:** Rate-based → `1` day
5. Click **Next**
6. **Target:** AWS service → Lambda function → `prod-calendar-sync`
7. Click through and **Create rule**

This triggers a Salesforce sync every 24 hours automatically.

---

### Step 9 — Run the first manual sync

1. Go to **Lambda → prod-calendar-sync → Test tab**
2. Create a new test event named `ManualSync` with this body:
   ```json
   { "httpMethod": "POST" }
   ```
3. Click **Test**
4. Check the **Execution results** — you should see:
   ```json
   { "message": "Sync completed successfully" }
   ```
5. In the **Log output**, look for a line like `Wrote 42 records` to confirm data was pulled from Salesforce

> **If it fails:** Check the log output for the error message. Common issues:
> - Wrong `SF_RECORD_TYPE_ID` → Salesforce returns 0 records (not an error, just empty)
> - Wrong secret name → `ResourceNotFoundException`
> - Wrong Salesforce credentials → `INVALID_LOGIN` error

---

## Phase 3 — Vercel

### Step 10 — Push the repo to GitHub

The project folder (`obk-calendar-main`) needs to be in a GitHub repository.

If it isn't already:

```bash
cd "C:\Users\orvil\Downloads\obk-calendar-main\obk-calendar-main"
git init
git add .
git commit -m "Initial commit"
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/obk-calendar.git
git push -u origin main
```

---

### Step 11 — Deploy to Vercel

1. Go to **vercel.com → Add New Project**
2. **Import Git Repository** → select your `obk-calendar` repo
3. **Framework Preset:** Other
4. **Root Directory:** leave as `/` (default)
5. Expand **Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `API_GATEWAY_URL` | _(the Invoke URL from Step 7)_ |

6. Click **Deploy**
7. Once deployed, Vercel gives you a URL like `https://obk-calendar.vercel.app`

---

## Phase 4 — Load Data & Verify

### Step 12 — Load Jewish holidays into DynamoDB

Run this from your terminal (requires AWS CLI to be configured):

```bash
aws dynamodb batch-write-item --request-file file://"C:\Users\orvil\Downloads\obk-calendar-main\obk-calendar-main\Documentation\jewish-holidays-batch-write.json"
```

This loads pre-configured Jewish holidays from 2025–2027 into DynamoDB. They show as red "KITCHEN CLOSED" blocks on the calendar.

---

### Step 13 — Verify the calendar

1. Open your Vercel URL in a browser
2. You should see:
   - Salesforce events in their colour-coded types (green, pink, purple, yellow)
   - Jewish holidays as red blocks with "KITCHEN CLOSED" watermark
3. Test the update fix: change a date on a Salesforce opportunity → wait for the next daily sync (or manually trigger Step 9 again) → confirm the event moves to the new date with no ghost at the old date

---

## Ongoing maintenance

| Task | How |
|------|-----|
| Force a re-sync now | Lambda → Test tab → run the `ManualSync` test event |
| Update Jewish holidays | See `Documentation/UPDATE_JEWISH_HOLIDAYS.md` |
| Update Lambda code | Re-zip `lambda/` folder → Lambda → Upload from .zip |
| View sync logs | CloudWatch → Log groups → `/aws/lambda/prod-calendar-sync` |
| Redeploy frontend | Push to GitHub → Vercel auto-deploys |

---

## Environment variable reference

### Lambda (AWS)

| Variable | Example value | Description |
|----------|--------------|-------------|
| `TABLE_NAME` | `prod-calendar-events` | DynamoDB table name |
| `SECRET_NAME` | `prod/salesforce/calendar` | Secrets Manager secret name |
| `SF_RECORD_TYPE_ID` | `0129q0000004JvEAAU` | Salesforce Opportunity RecordTypeId |

### Vercel (frontend)

| Variable | Example value | Description |
|----------|--------------|-------------|
| `API_GATEWAY_URL` | `https://xxxxxxxxxx.execute-api.ap-southeast-2.amazonaws.com/prod` | AWS API Gateway base URL |
