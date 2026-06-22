# Jewish Holiday Calendar Updates

## Overview
This document provides step-by-step instructions for updating Jewish holidays in the OBK calendar system. Jewish holidays are stored directly in DynamoDB alongside Salesforce events and appear automatically in the calendar interface.

## When to Update
- **Annually**: Update holidays for the next 3-4 years
- **Before September**: Jewish New Year (Rosh Hashanah) typically falls in September/October
- **When holidays are missing**: If users report missing blocked days for Jewish holidays

## Prerequisites
- AWS CLI configured with DynamoDB write permissions
- Access to the `prod-calendar-events` DynamoDB table
- Python 3 installed (for data formatting)

## Step-by-Step Process

### 1. Research Holiday Dates
Get accurate Jewish holiday dates for the target years:
- Use reliable sources like Hebcal.com, Chabad.org, or Jewish calendar APIs
- Consider Sydney, Australia timezone (UTC+10/+11 with DST)
- Include major holidays that require kitchen closure:
  - Rosh Hashanah (2 days)
  - Yom Kippur (1 day)
  - Sukkot (7 days)
  - Shemini Atzeret (1 day)
  - Simchat Torah (1 day)
  - Hanukkah (8 days)
  - Purim (1 day)
  - Passover (8 days)
  - Shavuot (2 days)

### 2. Create Holiday Data File

Create a JSON file with the DynamoDB structure. Each holiday needs:

```json
{
  "pk": {"S": "EVENT#JH-[HOLIDAY-NAME]-[YEAR]"},
  "sk": {"S": "METADATA#[START-DATE]"},
  "data": {
    "M": {
      "attributes": {
        "M": {
          "type": {"S": "Jewish Holiday"},
          "url": {"S": "/jewish-holidays/[holiday-name]-[year]"}
        }
      },
      "CloseDate": {"S": "[END-DATE]"},
      "Event_End_Date_Time__c": {"S": "[END-DATETIME-UTC]"},
      "Event_Start_Date_Time__c": {"S": "[START-DATETIME-UTC]"},
      "Id": {"S": "JH-[HOLIDAY-NAME]-[YEAR]"},
      "Name": {"S": "[Holiday Name] - Kitchen Closed ([Description])"},
      "Type": {"S": "Jewish Holiday"}
    }
  },
  "endTime": {"S": "[END-DATETIME-UTC]"},
  "eventId": {"S": "JH-[HOLIDAY-NAME]-[YEAR]"},
  "lastSynced": {"S": "[CURRENT-TIMESTAMP]"},
  "name": {"S": "[Holiday Name] - Kitchen Closed ([Description])"},
  "source": {"S": "JEWISH_HOLIDAYS"},
  "startTime": {"S": "[START-DATETIME-UTC]"},
  "type": {"S": "Jewish Holiday"}
}
```

**Important Notes:**
- Use `JH-` prefix for all Jewish holiday IDs
- Set `source` to `JEWISH_HOLIDAYS` (not `SALESFORCE`)
- Use UTC timestamps (Sydney time converted to UTC)
- Include "Kitchen Closed" in the name for clarity

### 3. Convert to DynamoDB Batch Format

Use this Python script to convert your JSON array to the correct batch-write format:

```bash
python3 -c "
import json

# Read your holiday data (array format)
with open('jewish-holidays-raw.json', 'r') as f:
    items = json.load(f)

# Create batch-write format
batch_request = {
    'prod-calendar-events': []
}

for item in items:
    batch_request['prod-calendar-events'].append({
        'PutRequest': {
            'Item': item
        }
    })

# Save batch-write format
with open('jewish-holidays-batch.json', 'w') as f:
    json.dump(batch_request, f, indent=2)

print(f'Created batch file with {len(items)} items')
"
```

### 4. Remove Old Holidays (Optional)

If updating existing years, first remove old holiday entries:

```bash
# Query existing Jewish holidays
aws dynamodb scan \
  --table-name prod-calendar-events \
  --filter-expression "#src = :source" \
  --expression-attribute-names '{"#src":"source"}' \
  --expression-attribute-values '{":source":{"S":"JEWISH_HOLIDAYS"}}' \
  --projection-expression "pk,sk"

# Delete specific holidays (example for 2025)
aws dynamodb delete-item \
  --table-name prod-calendar-events \
  --key '{"pk":{"S":"EVENT#JH-ROSH-HASHANAH-2025"},"sk":{"S":"METADATA#2025-09-22"}}'
```

### 5. Upload New Holidays

Upload the new holidays using batch-write:

```bash
aws dynamodb batch-write-item --request-items file://jewish-holidays-batch.json
```

**Success Response:**
```json
{
    "UnprocessedItems": {}
}
```

If there are unprocessed items, re-run the command with just those items.

### 6. Verify Upload

Check that holidays were added correctly:

```bash
# Count Jewish holidays in table
aws dynamodb scan \
  --table-name prod-calendar-events \
  --filter-expression "#src = :source" \
  --expression-attribute-names '{"#src":"source"}' \
  --expression-attribute-values '{":source":{"S":"JEWISH_HOLIDAYS"}}' \
  --select COUNT

# View a sample holiday
aws dynamodb get-item \
  --table-name prod-calendar-events \
  --key '{"pk":{"S":"EVENT#JH-ROSH-HASHANAH-2025"},"sk":{"S":"METADATA#2025-09-22"}}'
```

### 7. Test Calendar Display

1. Open the calendar application
2. Navigate to dates with Jewish holidays
3. Verify holidays appear as blocked events
4. Check that event details show "Kitchen Closed" messaging

## Important Limitations

- **Batch Size**: DynamoDB batch-write supports max 25 items per request
- **Rate Limits**: Don't exceed DynamoDB write capacity
- **Timezone**: All times must be in UTC (convert from Sydney time)
- **Naming**: Use consistent ID format `JH-[HOLIDAY]-[YEAR]`

## Troubleshooting

### Upload Fails
- Check AWS credentials and permissions
- Verify JSON format is correct
- Ensure batch size ≤ 25 items

### Holidays Don't Appear
- Verify `source` field is `JEWISH_HOLIDAYS`
- Check date range is within calendar view window (-30 to +90 days)
- Confirm Lambda is processing DynamoDB correctly

### Wrong Dates/Times
- Double-check timezone conversions (Sydney → UTC)
- Verify Jewish calendar dates from authoritative sources
- Consider daylight saving time changes

## File Cleanup

After successful upload, clean up temporary files:

```bash
rm jewish-holidays-raw.json
rm jewish-holidays-batch.json
```

## Annual Reminder

Set a calendar reminder for August each year to update Jewish holidays for the following 2-3 years.

---

**Last Updated:** August 2025  
**Next Update Due:** August 2026
