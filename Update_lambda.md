SYNCHRONIZATION MODIFICATIONS. 

In order to change dates for data syncy in the script you need to 

1. look at aws lambda prod-calendar-sync 
2. update the index.js inside it 
3. upload latest config. 

TROUBLESHOOTING LOGS

#LOOK AT latest logs: 
aws logs filter-log-events  --log-group-name "/aws/lambda/prod-calendar-sync"  --start-time $(date -u -v-30M +%s)000  --query 'events[*].[timestamp,message]' 





MAKING CHANGES: 
cd lambda-current
zip -r lambda-deployment.zip . -x "*.DS_Store" "current-lambda.zip"
aws lambda update-function-code --function-name prod-calendar-sync  --zip-file fileb://lambda-deployment.zip


There is a commented line in the source code of lambda that says: if (true).. using this comment / uncomment trick - triggering causes a resync without waiting for the even.t 







# Check Lambda function status
aws lambda get-function --function-name prod-calendar-sync --query 'Configuration.{FunctionName:FunctionName,Runtime:Runtime,LastModified:LastModified,CodeSize:CodeSize}'

# Test Lambda function directly
aws lambda invoke --function-name prod-calendar-sync --cli-binary-format raw-in-base64-out --payload '{"httpMethod":"GET","queryStringParameters":{"start":"2024-01-01","end":"2024-12-31"}}' response.json

# Check API Gateway endpoint
curl -X GET "https://0lxnnw8nik.execute-api.ap-southeast-2.amazonaws.com/prod/events"

# Test sync endpoint
curl -X POST "https://0lxnnw8nik.execute-api.ap-southeast-2.amazonaws.com/prod/sync"

Test all the dynamodb items inthe table : 
aws dynamodb scan --table-name prod-calendar-events --output text >> file.txt


