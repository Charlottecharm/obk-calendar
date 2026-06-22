require('dotenv').config();
const express = require('express');
const path = require('path');
const moment = require('moment-timezone');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API Gateway configuration
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'https://0lxnnw8nik.execute-api.ap-southeast-2.amazonaws.com/prod';

// Helper function to make API Gateway requests
async function callApiGateway(endpoint, method = 'GET', queryParams = {}) {
    try {
        if (!API_GATEWAY_URL) {
            throw new Error('API_GATEWAY_URL environment variable is not set');
        }

        const url = new URL(`${API_GATEWAY_URL}${endpoint}`);
        
        // Add query parameters
        Object.entries(queryParams).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });

        console.log('Making API Gateway request to:', url.toString());

        const headers = {
            'Content-Type': 'application/json',
        };

        const response = await fetch(url.toString(), {
            method,
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Gateway error response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`API Gateway request failed: ${response.statusText} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Gateway request error:', error);
        throw error;
    }
}

// API endpoint to fetch calendar events
app.get('/api/opportunities', async (req, res) => {
    try {
        // Get the requested date range from query parameters
        const startDate = req.query.start ? moment(req.query.start) : moment().subtract(30, 'days');
        const endDate = req.query.end ? moment(req.query.end) : moment().add(90, 'days');

        // Ensure we don't exceed 30 days
        const maxStartDate = moment().subtract(30, 'days');
        const maxEndDate = moment().add(90, 'days');
        
        const queryStartDate = startDate.isBefore(maxStartDate) ? maxStartDate : startDate;
        const queryEndDate = endDate.isAfter(maxEndDate) ? maxEndDate : endDate;

        // Call API Gateway to get events
        const response = await callApiGateway('/events', 'GET', {
            start: queryStartDate.toISOString(),
            end: queryEndDate.toISOString()
        });

        // Transform the response to match the expected format
        const transformedResponse = {
            opportunities: response.events.filter(event => event.type !== 'volunteer').map(event => ({
                Id: event.id,
                Name: event.title,
                Event_Start_Date_Time__c: moment(event.start).tz('Australia/Sydney').format(),
                Event_End_Date_Time__c: moment(event.end).tz('Australia/Sydney').format(),
                Type: event.type
            })),
            timeslots: response.events.filter(event => event.type === 'volunteer').map(event => ({
                Id: event.id,
                Name: event.title,
                goldenapp__Start__c: moment(event.start).tz('Australia/Sydney').format(),
                goldenapp__End__c: moment(event.end).tz('Australia/Sydney').format()
            }))
        };
        
        res.json(transformedResponse);
    } catch (error) {
        console.error('API request error:', error.message);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// API endpoint to trigger a sync
app.post('/api/sync', async (req, res) => {
    try {
        const response = await callApiGateway('/sync', 'POST');
        res.json(response);
    } catch (error) {
        console.error('Sync request error:', error.message);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`);
    });
}

module.exports = app; 
