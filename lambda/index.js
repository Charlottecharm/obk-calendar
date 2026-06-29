const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const jsforce = require('jsforce');
const moment = require('moment-timezone');

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const secretsClient = new SecretsManagerClient({});

async function getSalesforceCredentials() {
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRET_NAME })
  );
  return JSON.parse(response.SecretString);
}

async function initializeSalesforce() {
  const creds = await getSalesforceCredentials();
  const conn = new jsforce.Connection({ loginUrl: creds.loginUrl });
  // Salesforce requires password + security token concatenated
  await conn.login(creds.username, creds.password + (creds.securityToken || ''));
  return conn;
}

async function fetchSalesforceData(startDate, endDate) {
  const conn = await initializeSalesforce();
  const fmt = (d) => moment(d).format('YYYY-MM-DDTHH:mm:ssZ');

  const [oppResult, slotResult] = await Promise.all([
    conn.query(`
      SELECT Id, Name, CloseDate, Type, Event_Start_Date_Time__c, Event_End_Date_Time__c
      FROM Opportunity
      WHERE RecordTypeId = '${process.env.SF_RECORD_TYPE_ID}'
      AND Event_Start_Date_Time__c >= ${fmt(startDate)}
      AND Event_Start_Date_Time__c <= ${fmt(endDate)}
    `),
    conn.query(`
      SELECT Id, Name, goldenapp__Start__c, goldenapp__End__c
      FROM goldenapp__Volunteer_Opportunity_Timeslot__c
      WHERE goldenapp__Start__c >= ${fmt(startDate)}
      AND goldenapp__Start__c <= ${fmt(endDate)}
    `)
  ]);

  return {
    opportunities: oppResult.records,
    timeslots: slotResult.records
  };
}

async function scanAllSalesforceRecords() {
  const items = [];
  let lastKey;
  do {
    const result = await dynamo.send(new ScanCommand({
      TableName: process.env.TABLE_NAME,
      FilterExpression: '#src = :src',
      ExpressionAttributeNames: { '#src': 'source' },
      ExpressionAttributeValues: { ':src': 'SALESFORCE' },
      ExclusiveStartKey: lastKey
    }));
    items.push(...result.Items);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function batchDelete(items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await dynamo.send(new BatchWriteCommand({
      RequestItems: {
        [process.env.TABLE_NAME]: chunk.map(item => ({
          DeleteRequest: { Key: { pk: item.pk, sk: item.sk } }
        }))
      }
    }));
  }
}

async function batchPut(items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await dynamo.send(new BatchWriteCommand({
      RequestItems: {
        [process.env.TABLE_NAME]: chunk.map(item => ({
          PutRequest: { Item: item }
        }))
      }
    }));
  }
}

async function syncToDynamoDB(data) {
  const now = new Date().toISOString();

  const freshItems = [
    ...data.opportunities.map(opp => ({
      pk: `EVENT#${opp.Id}`,
      sk: `METADATA#${moment(opp.Event_Start_Date_Time__c).format('YYYY-MM-DD')}`,
      eventId: opp.Id,
      name: opp.Name,
      startTime: opp.Event_Start_Date_Time__c,
      endTime: opp.Event_End_Date_Time__c,
      type: opp.Type,
      source: 'SALESFORCE',
      lastSynced: now,
      data: opp
    })),
    ...data.timeslots.map(slot => ({
      pk: `TIMESLOT#${slot.Id}`,
      sk: `METADATA#${moment(slot.goldenapp__Start__c).format('YYYY-MM-DD')}`,
      eventId: slot.Id,
      name: slot.Name,
      startTime: slot.goldenapp__Start__c,
      endTime: slot.goldenapp__End__c,
      type: 'volunteer',
      source: 'SALESFORCE',
      lastSynced: now,
      data: slot
    }))
  ];

  // Build a set of (pk|sk) for every record we just fetched from Salesforce
  const freshKeys = new Set(freshItems.map(i => `${i.pk}|${i.sk}`));

  // Fetch all existing SALESFORCE records from DynamoDB
  const existingItems = await scanAllSalesforceRecords();

  // Delete any record that is no longer in Salesforce OR has a stale date (different SK)
  const stale = existingItems.filter(i => !freshKeys.has(`${i.pk}|${i.sk}`));
  if (stale.length > 0) {
    await batchDelete(stale);
    console.log(`Deleted ${stale.length} stale/moved records`);
  }

  await batchPut(freshItems);
  console.log(`Wrote ${freshItems.length} records`);
}

async function getEventsFromDynamoDB(startDate, endDate) {
  const startStr = moment(startDate).format('YYYY-MM-DD');
  const endStr = moment(endDate).format('YYYY-MM-DD');

  const items = [];
  let lastKey;
  do {
    const result = await dynamo.send(new ScanCommand({
      TableName: process.env.TABLE_NAME,
      FilterExpression: 'sk BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':start': `METADATA#${startStr}`,
        ':end': `METADATA#${endStr}`
      },
      ExclusiveStartKey: lastKey
    }));
    items.push(...result.Items);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items.map(item => ({
    id: item.eventId,
    title: item.name,
    start: item.startTime,
    end: item.endTime,
    type: item.type
  }));
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const isSync = event.httpMethod === 'POST' || !event.httpMethod;

    if (isSync) {
      const startDate = moment().subtract(30, 'days').toDate();
      const endDate = moment().add(120, 'days').toDate();

      const data = await fetchSalesforceData(startDate, endDate);
      await syncToDynamoDB(data);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Sync completed successfully' })
      };
    } else {
      const start = event.queryStringParameters?.start || moment().subtract(30, 'days').toISOString();
      const end = event.queryStringParameters?.end || moment().add(120, 'days').toISOString();

      const events = await getEventsFromDynamoDB(start, end);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ events })
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
